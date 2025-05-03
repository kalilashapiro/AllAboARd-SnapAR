export namespace RiverMeshGenerator {

    /**
     * Builds a RenderMesh representing a river with lips along a given path.
     * @param points An array of world space coordinates defining the center line of the river.
     * @param riverWidth The total width of the river bed (excluding lips).
     * @param lipHeight The vertical height of the lips.
     * @param lipWidth The horizontal width of the lips extending outwards.
     * @param bevelWidth The width of the bevel at the corners.
     * @returns A RenderMesh representing the generated river geometry.
     */
    export function buildRiverMesh(points: vec3[], riverWidth: number, lipHeight: number, lipWidth: number, bevelWidth: number): RenderMesh | null {
        if (points.length < 2 || riverWidth <= 0 || lipHeight < 0 || lipWidth < 0 || bevelWidth < 0) {
            print("RiverMeshGenerator: Invalid input parameters.");
            return null; // Not enough points or invalid dimensions
        }

        // Prevent bevel from exceeding half the smallest feature dimension it affects
        bevelWidth = Math.min(bevelWidth, lipWidth * 0.5, lipHeight * 0.5, riverWidth * 0.25);
        if (bevelWidth < 0.001) bevelWidth = 0; // Treat tiny bevels as no bevel

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
        const vertexCountPerSegment = bevelWidth > 0 ? 16 : 8; // Use 16 vertices if beveling

        for (let i = 0; i < points.length; i++) {
            const segment = pathSegmentsData[i];
            const p = segment.point;
            const right = segment.right;
            const up = segment.up; // Use the calculated 'up' for this segment
            const v = totalPathLength > 0 ? segment.length / totalPathLength : 0;

            // --- Calculate Reference Corner Points (Original 8 Points) ---
            const p0 = p.add(right.uniformScale(-halfTotalWidth));                               // Outer Left Base
            const p1 = p0.add(up.uniformScale(lipHeight));                                      // Outer Left Top
            const p3_ref = p.add(right.uniformScale(-halfRiverWidth));                          // Inner Left Base Ref
            const p2 = p3_ref.add(up.uniformScale(lipHeight));                                  // Inner Left Top
            const p4 = p.add(right.uniformScale(halfRiverWidth));                             // Inner Right Base
            const p5 = p4.add(up.uniformScale(lipHeight));                                      // Inner Right Top
            const p7_ref = p.add(right.uniformScale(halfTotalWidth));                           // Outer Right Base Ref
            const p6 = p7_ref.add(up.uniformScale(lipHeight));                                  // Outer Right Top
            const p3 = p3_ref; // Keep name consistent for now
            const p7 = p7_ref; // Keep name consistent for now

            // --- Normals for Flat Faces ---
            const normOuterWall = right.uniformScale(-1).normalize();
            const normInnerLeftWall = right.normalize();
            const normInnerRightWall = right.uniformScale(-1).normalize();
            const normOuterRightWall = right.normalize();
            const normLipTop = up.normalize();
            const normRiverBed = up.normalize(); // Assuming river bed faces up
            const normBase = up.uniformScale(-1).normalize(); // Normals for underneath faces (optional, might not be visible)

            // --- Directions for Bevel Offsets ---
            const dirUp = up.normalize();
            const dirDown = dirUp.uniformScale(-1);
            const dirRight = right.normalize();
            const dirLeft = dirRight.uniformScale(-1);

            // --- Calculate Final 16 Vertices & Normals ---
            let finalVertices: vec3[] = [];
            let finalNormals: vec3[] = [];
            let finalUVs: vec2[] = [];

            if (bevelWidth > 0) {
                // Calculate 16 points with bevels
                const bw = bevelWidth;

                // Bevel Normals (Normalized sum of adjacent face normals)
                const norm0_bevel = dirDown.add(dirLeft).normalize(); // Outer Left Base Bevel
                const norm1_bevel = dirUp.add(dirLeft).normalize();   // Outer Left Top Bevel
                const norm2_bevel = dirUp.add(dirRight).normalize();  // Inner Left Top Bevel
                const norm3_bevel = dirDown.add(dirRight).normalize(); // Inner Left Base Bevel
                const norm4_bevel = dirDown.add(dirLeft).normalize(); // Inner Right Base Bevel
                const norm5_bevel = dirUp.add(dirLeft).normalize();   // Inner Right Top Bevel
                const norm6_bevel = dirUp.add(dirRight).normalize();  // Outer Right Top Bevel
                const norm7_bevel = dirDown.add(dirRight).normalize(); // Outer Right Base Bevel

                // Calculate 16 points & add data
                // P0 Bevel (Outer Left Base)
                finalVertices.push(p0.add(dirUp.uniformScale(bw)));      // P0a (up from p0)
                finalNormals.push(normOuterWall);
                finalUVs.push(new vec2(0, v));
                finalVertices.push(p0.add(dirRight.uniformScale(bw)));   // P0b (right from p0)
                finalNormals.push(normBase); // Assuming base faces down
                finalUVs.push(new vec2(bw / totalWidth, v));

                // P1 Bevel (Outer Left Top)
                finalVertices.push(p1.add(dirDown.uniformScale(bw)));    // P1a (down from p1)
                finalNormals.push(normOuterWall);
                finalUVs.push(new vec2(0, v));
                finalVertices.push(p1.add(dirRight.uniformScale(bw)));   // P1b (right from p1)
                finalNormals.push(normLipTop);
                finalUVs.push(new vec2(bw / totalWidth, v));

                // P2 Bevel (Inner Left Top)
                finalVertices.push(p2.add(dirLeft.uniformScale(bw)));    // P2a (left from p2)
                finalNormals.push(normLipTop);
                finalUVs.push(new vec2(uLip - bw / totalWidth, v));
                finalVertices.push(p2.add(dirDown.uniformScale(bw)));    // P2b (down from p2)
                finalNormals.push(normInnerLeftWall);
                finalUVs.push(new vec2(uLip, v));

                // P3 Bevel (Inner Left Base)
                finalVertices.push(p3.add(dirUp.uniformScale(bw)));      // P3a (up from p3)
                finalNormals.push(normInnerLeftWall);
                finalUVs.push(new vec2(uLip, v));
                finalVertices.push(p3.add(dirRight.uniformScale(bw)));   // P3b (right from p3)
                finalNormals.push(normRiverBed);
                finalUVs.push(new vec2(uLip + bw / totalWidth, v));

                // P4 Bevel (Inner Right Base)
                finalVertices.push(p4.add(dirLeft.uniformScale(bw)));    // P4a (left from p4)
                finalNormals.push(normRiverBed);
                finalUVs.push(new vec2(uRiver - bw / totalWidth, v));
                finalVertices.push(p4.add(dirUp.uniformScale(bw)));      // P4b (up from p4)
                finalNormals.push(normInnerRightWall);
                finalUVs.push(new vec2(uRiver, v));

                // P5 Bevel (Inner Right Top)
                finalVertices.push(p5.add(dirDown.uniformScale(bw)));    // P5a (down from p5)
                finalNormals.push(normInnerRightWall);
                finalUVs.push(new vec2(uRiver, v));
                finalVertices.push(p5.add(dirLeft.uniformScale(bw)));     // P5b (left from p5)
                finalNormals.push(normLipTop);
                finalUVs.push(new vec2(uRiver + bw / totalWidth, v));

                // P6 Bevel (Outer Right Top)
                finalVertices.push(p6.add(dirRight.uniformScale(bw)));   // P6a (right from p6)
                finalNormals.push(normLipTop);
                finalUVs.push(new vec2(1 - bw / totalWidth, v));
                finalVertices.push(p6.add(dirDown.uniformScale(bw)));    // P6b (down from p6)
                finalNormals.push(normOuterRightWall);
                finalUVs.push(new vec2(1, v));

                // P7 Bevel (Outer Right Base)
                finalVertices.push(p7.add(dirUp.uniformScale(bw)));      // P7a (up from p7)
                finalNormals.push(normOuterRightWall);
                finalUVs.push(new vec2(1, v));
                finalVertices.push(p7.add(dirLeft.uniformScale(bw)));     // P7b (left from p7)
                finalNormals.push(normBase);
                finalUVs.push(new vec2(1 - bw / totalWidth, v));

                // Push bevel normals later if needed, using simplified flat normals for now

            } else {
                // Original 8 points, no bevel
                finalVertices.push(p0, p1, p2, p3, p4, p5, p6, p7);
                // Assign original simplified normals
                finalNormals.push(normOuterWall, normOuterWall, normLipTop, normInnerLeftWall, normInnerRightWall, normLipTop, normOuterRightWall, normOuterRightWall);
                // Assign original UVs
                finalUVs.push(new vec2(0, v), new vec2(0, v), new vec2(uLip, v), new vec2(uLip, v), new vec2(uRiver, v), new vec2(uRiver, v), new vec2(1, v), new vec2(1, v));
            }

            // Add vertices [pos.x, pos.y, pos.z, norm.x, norm.y, norm.z, uv.x, uv.y]
            for(let j=0; j<finalVertices.length; j++) {
                const vert = finalVertices[j];
                const norm = finalNormals[j];
                const uv = finalUVs[j];
                vertices.push(vert.x, vert.y, vert.z, norm.x, norm.y, norm.z, uv.x, uv.y);
            }
        }

        builder.appendVerticesInterleaved(vertices);

        // --- 3. Generate Indices --- (NEEDS COMPLETE REWRITE for 16 vertices)
        const indices: number[] = [];
        print("RiverMeshGenerator: WARNING - Index generation needs update for bevels!");
        if (bevelWidth > 0) {
            // Index generation for 16 vertices (16 quads closing the loop)
            for (let i = 0; i < points.length - 1; i++) {
                const idx = i * vertexCountPerSegment; // vertexCountPerSegment is 16 here
                const nextIdx = (i + 1) * vertexCountPerSegment;

                // Helper function for adding quads with standard winding
                const addQuad = (vIdx0: number, vIdx1: number) => {
                    const currA = idx + vIdx0;
                    const currB = idx + vIdx1;
                    const nextA = nextIdx + vIdx0;
                    const nextB = nextIdx + vIdx1;
                    // Standard CCW winding for outward facing quad
                    indices.push(currA, nextA, nextB); // Triangle 1: current A, next A, next B
                    indices.push(nextB, currB, currA); // Triangle 2: next B, current B, current A
                };

                // Add the 16 quads connecting specific vertices based on |/_\__/_| structure
                addQuad(0, 2);  // 1. Outer Left Wall
                addQuad(2, 3);  // 2. Outer Left Top Bevel
                addQuad(3, 4);  // 3. Left Lip Top
                addQuad(4, 5);  // 4. Inner Left Top Bevel
                addQuad(5, 6);  // 5. Inner Left Wall
                addQuad(6, 7);  // 6. Inner Left Base Bevel
                addQuad(7, 8);  // 7. River Bed
                addQuad(8, 9);  // 8. Inner Right Base Bevel
                addQuad(9, 10); // 9. Inner Right Wall
                addQuad(10, 11);// 10. Inner Right Top Bevel
                addQuad(11, 12);// 11. Right Lip Top
                addQuad(12, 13);// 12. Outer Right Top Bevel
                addQuad(13, 14);// 13. Outer Right Wall
                addQuad(14, 15);// 14. Outer Right Base Bevel
                addQuad(15, 1); // 15. Base Flat
                addQuad(1, 0);  // 16. Outer Left Base Bevel (closes loop)
            }
        } else {
            // Original Index generation for 8 vertices
            for (let i = 0; i < points.length - 1; i++) {
                const idx = i * vertexCountPerSegment; // vertexCountPerSegment is 8 here
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
        }

        if (indices.length === 0 && points.length >= 2 && bevelWidth == 0) {
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