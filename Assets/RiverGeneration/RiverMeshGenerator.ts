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

        // --- 2. Generate Vertices & Indices for Flat Shading ---
        const vertices: number[] = [];
        const indices: number[] = [];
        let vertexIndex = 0;

        // Define U coordinates for edges
        const uCoords = [0, 0, uLip, uLip, uRiver, uRiver, 1, 1]; // U-coord for p0, p1, p2, p3, p4, p5, p6, p7

        for (let i = 0; i < points.length - 1; i++) {
            const segment_i = pathSegmentsData[i];
            const segment_i1 = pathSegmentsData[i + 1];

            const p_i = segment_i.point;
            const right_i = segment_i.right;
            const up_i = segment_i.up;
            const v_i = totalPathLength > 0 ? segment_i.length / totalPathLength : 0;

            const p_i1 = segment_i1.point;
            const right_i1 = segment_i1.right; // Not strictly needed if using normals from segment i
            const up_i1 = segment_i1.up;       // Not strictly needed if using normals from segment i
            const v_i1 = totalPathLength > 0 ? segment_i1.length / totalPathLength : 0;

            // Calculate 8 points for cross-section i
            const p0_i = p_i.add(right_i.uniformScale(-halfTotalWidth));
            const p1_i = p0_i.add(up_i.uniformScale(lipHeight));
            const p3_i = p_i.add(right_i.uniformScale(-halfRiverWidth));
            const p2_i = p3_i.add(up_i.uniformScale(lipHeight));
            const p4_i = p_i.add(right_i.uniformScale(halfRiverWidth));
            const p5_i = p4_i.add(up_i.uniformScale(lipHeight));
            const p7_i = p_i.add(right_i.uniformScale(halfTotalWidth));
            const p6_i = p7_i.add(up_i.uniformScale(lipHeight));
            const points_i = [p0_i, p1_i, p2_i, p3_i, p4_i, p5_i, p6_i, p7_i];

            // Calculate 8 points for cross-section i+1
            const p0_i1 = p_i1.add(segment_i1.right.uniformScale(-halfTotalWidth)); // Use i+1 basis
            const p1_i1 = p0_i1.add(segment_i1.up.uniformScale(lipHeight));
            const p3_i1 = p_i1.add(segment_i1.right.uniformScale(-halfRiverWidth));
            const p2_i1 = p3_i1.add(segment_i1.up.uniformScale(lipHeight));
            const p4_i1 = p_i1.add(segment_i1.right.uniformScale(halfRiverWidth));
            const p5_i1 = p4_i1.add(segment_i1.up.uniformScale(lipHeight));
            const p7_i1 = p_i1.add(segment_i1.right.uniformScale(halfTotalWidth));
            const p6_i1 = p7_i1.add(segment_i1.up.uniformScale(lipHeight));
            const points_i1 = [p0_i1, p1_i1, p2_i1, p3_i1, p4_i1, p5_i1, p6_i1, p7_i1];

            // Normals for faces (using segment i's orientation)
            const normOuterLeft = right_i.uniformScale(-1);
            const normInnerLeft = right_i;
            const normInnerRight = right_i.uniformScale(-1);
            const normOuterRight = right_i;
            const normTop = up_i;
            const faceNormals = [
                normOuterLeft,  // Face P0-P1
                normTop,        // Face P1-P2
                normInnerLeft,  // Face P2-P3
                normTop,        // Face P3-P4 (River bed)
                normInnerRight, // Face P4-P5
                normTop,        // Face P5-P6
                normOuterRight  // Face P6-P7
            ];

            // Generate the 7 quads
            for (let j = 0; j < 7; j++) {
                const currentP_a = points_i[j];       // e.g., p0_i
                const currentP_b = points_i[j + 1];   // e.g., p1_i
                const nextP_a = points_i1[j];      // e.g., p0_i1
                const nextP_b = points_i1[j + 1];  // e.g., p1_i1

                const faceNormal = faceNormals[j];
                const u_a = uCoords[j];
                const u_b = uCoords[j + 1];

                // Add 4 vertices for the quad
                // v0: currentP_a
                vertices.push(currentP_a.x, currentP_a.y, currentP_a.z, faceNormal.x, faceNormal.y, faceNormal.z, u_a, v_i);
                // v1: currentP_b
                vertices.push(currentP_b.x, currentP_b.y, currentP_b.z, faceNormal.x, faceNormal.y, faceNormal.z, u_b, v_i);
                // v2: nextP_a
                vertices.push(nextP_a.x, nextP_a.y, nextP_a.z, faceNormal.x, faceNormal.y, faceNormal.z, u_a, v_i1);
                // v3: nextP_b
                vertices.push(nextP_b.x, nextP_b.y, nextP_b.z, faceNormal.x, faceNormal.y, faceNormal.z, u_b, v_i1);

                // Add 6 indices for the two triangles (winding order from previous fix)
                indices.push(vertexIndex + 0, vertexIndex + 3, vertexIndex + 2); // Triangle 1 (v0, v3, v2)
                indices.push(vertexIndex + 3, vertexIndex + 0, vertexIndex + 1); // Triangle 2 (v3, v0, v1)

                vertexIndex += 4; // Increment base index for next quad
            }
        }

        builder.appendVerticesInterleaved(vertices);
        builder.appendIndices(indices);

        // --- 4. Finalize Mesh ---
        if (!builder.isValid()) {
            print("RiverMeshGenerator: MeshBuilder state is invalid before finalizing.");
            return null;
        }

        builder.updateMesh();

        print(`RiverMeshGenerator: Generated flat-shaded mesh with ${vertices.length / (3+3+2)} vertices and ${indices.length / 3} triangles.`);
        return builder.getMesh();
    }

} 