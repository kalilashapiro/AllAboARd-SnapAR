export namespace RiverMeshGenerator {

    // Helper function to clamp a value
    function clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(value, max));
    }

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
            let right: vec3;
            let segmentUp: vec3;

            // --- Calculate Forward Vector (Same as before) ---
            if (i < points.length - 1) {
                forward = points[i + 1].sub(currentPoint);
            } else {
                forward = new vec3(pathSegmentsData[i - 1].forward.x, pathSegmentsData[i - 1].forward.y, pathSegmentsData[i - 1].forward.z); // Use new vec3 to clone
            }
            const fwdLengthSq = forward.lengthSquared;
            if (fwdLengthSq < 0.0001) {
                if (i > 0) forward = new vec3(pathSegmentsData[i - 1].forward.x, pathSegmentsData[i - 1].forward.y, pathSegmentsData[i - 1].forward.z); // Use new vec3 to clone
                else forward = vec3.forward();
            } else {
                forward = forward.normalize();
            }
            // --- End Forward Calculation ---

            // --- Calculate Horizontal Right and Local Up ---
            const tempRight = forward.cross(upVec);
            if (tempRight.lengthSquared < 0.0001) {
                // Forward is aligned with world up (vertical path segment)
                if (i > 0) {
                    // Reuse previous segment's right vector for continuity
                    right = new vec3(pathSegmentsData[i - 1].right.x, pathSegmentsData[i - 1].right.y, pathSegmentsData[i - 1].right.z);
                    print(`Warning: Vertical segment ${i}, reusing previous right.`);
                } else {
                    // First segment is vertical, fallback to world right
                    right = vec3.right();
                    print(`Warning: First segment is vertical, using world right.`);
                }
            } else {
                // Normalize the calculated horizontal right vector
                right = tempRight.normalize();
            }

            // Calculate local up based on forward and horizontal right
            segmentUp = right.cross(forward).normalize();
            // --- End Right and Up Calculation ---

            // Calculate segment length for V coordinate
            if (i > 0) {
                accumulatedLength += points[i].distance(points[i - 1]);
            }

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

        // Pre-calculate segment directions for curvature estimation
        const segmentDirections: vec3[] = [];
        for (let i = 0; i < points.length - 1; i++) {
            segmentDirections.push(points[i + 1].sub(points[i]).normalize());
        }

        for (let i = 0; i < points.length - 1; i++) {
            const segment_i = pathSegmentsData[i];
            const segment_i1 = pathSegmentsData[i + 1];

            const p_i = segment_i.point;
            const right_i = segment_i.right;
            const up_i = segment_i.up;
            const v_i = totalPathLength > 0 ? segment_i.length / totalPathLength : 0;

            const p_i1 = segment_i1.point;
            const v_i1 = totalPathLength > 0 ? segment_i1.length / totalPathLength : 0;

            // --- Calculate Width Scaling based on curvature at point i ---
            let widthScale = 1.0;
            let leftScale = 1.0;
            let rightScale = 1.0;
            const minWidthScale = 0.2; // Minimum scale factor (e.g., 20%)
            const straightThreshold = 0.99; // Dot product close to 1

            if (i > 0 && i < points.length - 2) { // Can calculate turn only for internal points
                const dir_in = segmentDirections[i - 1]; // Direction leading to point i
                const dir_out = segmentDirections[i];    // Direction leaving point i
                const dotProd = clamp(dir_in.dot(dir_out), -1.0, 1.0);

                if (dotProd < straightThreshold) { // It's a turn
                    widthScale = clamp((dotProd + 1.0) * 0.5, minWidthScale, 1.0); // Map [-1, 1] to [min, 1]
                    // Simple linear mapping for now: widthScale = clamp(dotProd, minWidthScale, 1.0);
                     // Map dot product [-1, 1] to scale [minWidthScale, 1.0]
                    // Higher dot product (straighter) -> higher scale
                    widthScale = clamp(minWidthScale + (1.0 - minWidthScale) * (dotProd + 1.0) / 2.0, minWidthScale, 1.0);


                    const turnCross = dir_in.cross(dir_out);
                    // Check alignment with segment's up vector to determine turn direction relative to path
                    if (turnCross.dot(up_i) > 0) { // Left turn (relative to path direction)
                        rightScale = widthScale; // Inner bank is right
                    } else { // Right turn
                        leftScale = widthScale; // Inner bank is left
                    }
                }
            }
            // --- End Width Scaling Calculation ---

            // Calculate scaled widths for cross-section i
            const leftHalfTotalWidth = halfTotalWidth * leftScale;
            const rightHalfTotalWidth = halfTotalWidth * rightScale;
            // Adjust inner river width calculation based on which side scaled
            const leftHalfRiverWidth = Math.max(0, leftHalfTotalWidth - lipWidth);
            const rightHalfRiverWidth = Math.max(0, rightHalfTotalWidth - lipWidth);


            // Calculate 8 points for cross-section i using scaled widths
            const p0_i = p_i.add(right_i.uniformScale(-leftHalfTotalWidth)); // Use left scale
            const p1_i = p0_i.add(up_i.uniformScale(lipHeight));
            const p3_i = p_i.add(right_i.uniformScale(-leftHalfRiverWidth)); // Use left scale
            const p2_i = p3_i.add(up_i.uniformScale(lipHeight));
            const p4_i = p_i.add(right_i.uniformScale(rightHalfRiverWidth)); // Use right scale
            const p5_i = p4_i.add(up_i.uniformScale(lipHeight));
            const p7_i = p_i.add(right_i.uniformScale(rightHalfTotalWidth)); // Use right scale
            const p6_i = p7_i.add(up_i.uniformScale(lipHeight));
            const points_i = [p0_i, p1_i, p2_i, p3_i, p4_i, p5_i, p6_i, p7_i];

            // Calculate 8 points for cross-section i+1 (COULD also apply scaling based on turn at i+1, but simpler for now to use i)
            // For simplicity, we use the scaling determined at point i for the segment i -> i+1
            // A more advanced method might blend scales or calculate scale for i+1 too
            const p0_i1 = p_i1.add(segment_i1.right.uniformScale(-leftHalfTotalWidth)); // Use scale from i
            const p1_i1 = p0_i1.add(segment_i1.up.uniformScale(lipHeight));
            const p3_i1 = p_i1.add(segment_i1.right.uniformScale(-leftHalfRiverWidth)); // Use scale from i
            const p2_i1 = p3_i1.add(segment_i1.up.uniformScale(lipHeight));
            const p4_i1 = p_i1.add(segment_i1.right.uniformScale(rightHalfRiverWidth)); // Use scale from i
            const p5_i1 = p4_i1.add(segment_i1.up.uniformScale(lipHeight));
            const p7_i1 = p_i1.add(segment_i1.right.uniformScale(rightHalfTotalWidth)); // Use scale from i
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