export namespace RiverMeshGenerator {

    /**
     * Builds a RenderMesh representing a river with lips along a given path.
     * @param points An array of world space coordinates defining the center line of the river.
     * @param riverWidth The total width of the river bed (excluding lips).
     * @param lipHeight The vertical height of the lips.
     * @param lipWidth The horizontal width of the lips extending outwards.
     * @returns A RenderMesh representing the generated river geometry.
     */
    export function buildRiverMesh(points: vec3[], riverWidth: number, lipHeight: number, lipWidth: number): RenderMesh | null {
        if (points.length < 2 || riverWidth <= 0 || lipHeight < 0 || lipWidth < 0) {
            print("RiverMeshGenerator: Invalid input parameters.");
            return null; // Not enough points or invalid dimensions
        }

        let builder = new MeshBuilder([
            { name: "position", components: 3 },
            { name: "normal", components: 3, normalized: true },
            { name: "texture0", components: 2 }
        ]);

        builder.topology = MeshTopology.Triangles;
        builder.indexType = MeshIndexType.UInt16; // Or UInt32 if many points

        const upVec = vec3.up();
        const halfRiverWidth = riverWidth * 0.5;
        const totalWidth = riverWidth + 2 * lipWidth;
        const halfTotalWidth = totalWidth * 0.5;
        const uLip = lipWidth / totalWidth; // U-coord at inner lip edge
        const uRiver = (lipWidth + riverWidth) / totalWidth; // U-coord at outer river edge (inner lip edge on other side)


        // --- 1. Calculate path segment data (orientation and length) ---
        const pathSegmentsData: { point: vec3, forward: vec3, right: vec3, up: vec3, length: number }[] = [];
        let accumulatedLength = 0;

        for (let i = 0; i < points.length; i++) {
            const currentPoint = points[i];
            let forward: vec3;

            if (i < points.length - 1) {
                forward = points[i + 1].sub(currentPoint).normalize();
            } else {
                // Last point uses the direction from the previous segment
                forward = currentPoint.sub(points[i - 1]).normalize();
            }

            // Ensure forward is not zero vector (coincident points)
            const fwdLength = forward.length; // Get length
            if (fwdLength * fwdLength < 0.0001) { // Square manually
                if (i > 0) forward = pathSegmentsData[i - 1].forward; // Use previous forward
                else forward = vec3.forward(); // Default if first two points are coincident
            }


            // Calculate segment length for V coordinate
            if (i > 0) {
                accumulatedLength += points[i].distance(points[i - 1]);
            }

            // Calculate orthonormal basis
            let right = forward.cross(upVec).normalize();
            // If forward is aligned with upVec, pick an arbitrary right vector
            const rightLength = right.length; // Get length
            if (rightLength * rightLength < 0.0001) { // Square manually
                right = vec3.right();
            }
            let segmentUp = right.cross(forward).normalize(); // Recompute 'up' to be orthogonal

            pathSegmentsData.push({
                point: currentPoint,
                forward: forward,
                right: right,
                up: segmentUp,
                length: accumulatedLength
            });
        }
        const totalPathLength = accumulatedLength;

        // --- 2. Generate Vertices ---
        const vertices: number[] = [];
        const vertexCountPerSegment = 8; // 8 points define the cross-section

        for (let i = 0; i < points.length; i++) {
            const segment = pathSegmentsData[i];
            const p = segment.point;
            const right = segment.right;
            const up = segment.up; // Use the calculated 'up' for this segment
            const v = totalPathLength > 0 ? segment.length / totalPathLength : 0;

            // Calculate the 8 cross-section points
            const p0_OuterLeftBase = p.add(right.uniformScale(-halfTotalWidth));
            const p1_OuterLeftTop = p0_OuterLeftBase.add(up.uniformScale(lipHeight));
            const p3_InnerLeftBase = p.add(right.uniformScale(-halfRiverWidth));
            const p2_InnerLeftTop = p3_InnerLeftBase.add(up.uniformScale(lipHeight));
            const p4_InnerRightBase = p.add(right.uniformScale(halfRiverWidth));
            const p5_InnerRightTop = p4_InnerRightBase.add(up.uniformScale(lipHeight));
            const p7_OuterRightBase = p.add(right.uniformScale(halfTotalWidth));
            const p6_OuterRightTop = p7_OuterRightBase.add(up.uniformScale(lipHeight));

            // Calculate normals (smoothed approach by averaging adjacent face normals)
            // Normals for vertical faces point directly left/right
            // Normals for horizontal faces point up
            const normOuterLeft = right.uniformScale(-1);
            const normInnerLeft = right;
            const normInnerRight = right.uniformScale(-1);
            const normOuterRight = right;
            const normTop = up;

            // Simplified normals (can be improved with averaging)
            const n0 = normOuterLeft; // Outer Left Base
            const n1 = normOuterLeft; // Outer Left Top (for wall) -> average with up?
            const n2 = normTop;       // Inner Left Top (for top) -> average with inner left?
            const n3 = normInnerLeft; // Inner Left Base (for wall) -> average with up?
            const n4 = normInnerRight;// Inner Right Base (for wall) -> average with up?
            const n5 = normTop;       // Inner Right Top (for top) -> average with inner right?
            const n6 = normOuterRight;// Outer Right Top (for wall) -> average with up?
            const n7 = normOuterRight;// Outer Right Base

            // Add vertices [pos.x, pos.y, pos.z, norm.x, norm.y, norm.z, uv.x, uv.y]
            // P0 - Outer Left Base
            vertices.push(p0_OuterLeftBase.x, p0_OuterLeftBase.y, p0_OuterLeftBase.z, n0.x, n0.y, n0.z, 0, v);
            // P1 - Outer Left Top
            vertices.push(p1_OuterLeftTop.x, p1_OuterLeftTop.y, p1_OuterLeftTop.z, n1.x, n1.y, n1.z, 0, v); // Use n1 for wall, may need split vertex later
            // P2 - Inner Left Top
            vertices.push(p2_InnerLeftTop.x, p2_InnerLeftTop.y, p2_InnerLeftTop.z, n2.x, n2.y, n2.z, uLip, v);
            // P3 - Inner Left Base
            vertices.push(p3_InnerLeftBase.x, p3_InnerLeftBase.y, p3_InnerLeftBase.z, n3.x, n3.y, n3.z, uLip, v);
            // P4 - Inner Right Base
            vertices.push(p4_InnerRightBase.x, p4_InnerRightBase.y, p4_InnerRightBase.z, n4.x, n4.y, n4.z, uRiver, v);
            // P5 - Inner Right Top
            vertices.push(p5_InnerRightTop.x, p5_InnerRightTop.y, p5_InnerRightTop.z, n5.x, n5.y, n5.z, uRiver, v);
            // P6 - Outer Right Top
            vertices.push(p6_OuterRightTop.x, p6_OuterRightTop.y, p6_OuterRightTop.z, n6.x, n6.y, n6.z, 1, v);
            // P7 - Outer Right Base
            vertices.push(p7_OuterRightBase.x, p7_OuterRightBase.y, p7_OuterRightBase.z, n7.x, n7.y, n7.z, 1, v);

        }

        builder.appendVerticesInterleaved(vertices);

        // --- 3. Generate Indices ---
        const indices: number[] = [];
        for (let i = 0; i < points.length - 1; i++) {
            const idx = i * vertexCountPerSegment;
            const nextIdx = (i + 1) * vertexCountPerSegment;

            // Create the 7 quads (14 triangles) connecting segment i to i+1
            // Quad structure: (current_a, next_a, next_b, current_b) -> Tri1(ca, na, nb), Tri2(nb, cb, ca)

            // Outer Left Wall (P0-P1) - Reversed Winding
            indices.push(idx + 0, nextIdx + 1, nextIdx + 0); // Swapped last two
            indices.push(nextIdx + 1, idx + 0, idx + 1); // Swapped last two

            // Left Lip Top (P1-P2) - Reversed Winding (Correct from previous edit)
            indices.push(idx + 1, nextIdx + 2, nextIdx + 1);
            indices.push(nextIdx + 2, idx + 1, idx + 2);

            // Inner Left Wall (P2-P3) - Reversed Winding
            indices.push(idx + 2, nextIdx + 3, nextIdx + 2); // Swapped last two
            indices.push(nextIdx + 3, idx + 2, idx + 3); // Swapped last two

            // River Bed (P3-P4) - Reversed Winding (Correct from previous edit)
            indices.push(idx + 3, nextIdx + 4, nextIdx + 3);
            indices.push(nextIdx + 4, idx + 3, idx + 4);

            // Inner Right Wall (P4-P5) - Reversed Winding
            indices.push(idx + 4, nextIdx + 5, nextIdx + 4); // Swapped last two
            indices.push(nextIdx + 5, idx + 4, idx + 5); // Swapped last two

            // Right Lip Top (P5-P6) - Reversed Winding (Correct from previous edit)
            indices.push(idx + 5, nextIdx + 6, nextIdx + 5);
            indices.push(nextIdx + 6, idx + 5, idx + 6);

            // Outer Right Wall (P6-P7) - Reversed Winding
            indices.push(idx + 6, nextIdx + 7, nextIdx + 6); // Swapped last two
            indices.push(nextIdx + 7, idx + 6, idx + 7); // Swapped last two
        }

        if (indices.length === 0 && points.length >= 2) {
            print("RiverMeshGenerator: No indices generated, check logic for segment connection.");
        }

        builder.appendIndices(indices);

        // --- 4. Finalize Mesh ---
        if (!builder.isValid()) {
            print("RiverMeshGenerator: MeshBuilder state is invalid before finalizing.");
            return null;
        }

        builder.updateMesh();

        print(`RiverMeshGenerator: Generated mesh with ${vertices.length / vertexCountPerSegment} vertices and ${indices.length / 3} triangles.`);
        return builder.getMesh();
    }

} 