export namespace RiverMeshGenerator {

    // Helper function to clamp a value
    function clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(value, max));
    }

    // Helper function to average two vectors (simple midpoint)
    function averageVec3(a: vec3, b: vec3): vec3 {
        return a.add(b).uniformScale(0.5);
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

        // --- 2. Generate Vertices (Smooth Shading with Averaged Normals) ---
        const vertices: number[] = [];
        const vertexCountPerSegment = 8; // Back to 8 shared vertices

        // Pre-calculate segment directions for curvature estimation
        const segmentDirections: vec3[] = [];
        for (let i = 0; i < points.length - 1; i++) {
            segmentDirections.push(points[i + 1].sub(points[i]).normalize());
        }

        for (let i = 0; i < points.length; i++) {
            const segment_i = pathSegmentsData[i];
            const p_i = segment_i.point;
            const right_i = segment_i.right;
            const up_i = segment_i.up;
            const v_i = totalPathLength > 0 ? segment_i.length / totalPathLength : 0;

            // Get next segment's frame for averaging normals (handle last point)
            const segment_i1 = (i < points.length - 1) ? pathSegmentsData[i + 1] : segment_i;
            const right_i1 = segment_i1.right;
            const up_i1 = segment_i1.up;

            // --- Width Scaling Calculation --- (Keep this logic)
            let leftScale = 1.0;
            let rightScale = 1.0;
            const minWidthScale = 0.2;
            const straightThreshold = 0.99;
             if (i > 0 && i < points.length - 1) { 
                 const dir_in = (i > 0) ? segmentDirections[i - 1] : segmentDirections[0]; 
                 const dir_out = (i < segmentDirections.length) ? segmentDirections[i] : segmentDirections[segmentDirections.length -1]; 
                const dotProd = clamp(dir_in.dot(dir_out), -1.0, 1.0);
                if (dotProd < straightThreshold) {
                    let widthScale = clamp(minWidthScale + (1.0 - minWidthScale) * (dotProd + 1.0) / 2.0, minWidthScale, 1.0);
                    const turnCross = dir_in.cross(dir_out);
                    if (turnCross.dot(up_i) > 0) { rightScale = widthScale; }
                    else { leftScale = widthScale; }
                }
            }
            // --- End Width Scaling ---

            const leftHalfTotalWidth = halfTotalWidth * leftScale;
            const rightHalfTotalWidth = halfTotalWidth * rightScale;
            const leftHalfRiverWidth = Math.max(0, leftHalfTotalWidth - lipWidth);
            const rightHalfRiverWidth = Math.max(0, rightHalfTotalWidth - lipWidth);

            // Calculate base positions
            const p0 = p_i.add(right_i.uniformScale(-leftHalfTotalWidth));
            const p1 = p0.add(up_i.uniformScale(lipHeight));
            const p3 = p_i.add(right_i.uniformScale(-leftHalfRiverWidth));
            const p2 = p3.add(up_i.uniformScale(lipHeight));
            const p4 = p_i.add(right_i.uniformScale(rightHalfRiverWidth));
            const p5 = p4.add(up_i.uniformScale(lipHeight));
            const p7 = p_i.add(right_i.uniformScale(rightHalfTotalWidth));
            const p6 = p7.add(up_i.uniformScale(lipHeight));

            // Estimate face normals by averaging adjacent segment frames
            const avgNormOuterLeft = averageVec3(right_i, right_i1).uniformScale(-1.0).normalize();
            const avgNormInnerLeft = averageVec3(right_i, right_i1).normalize();
            const avgNormTop = averageVec3(up_i, up_i1).normalize(); // Average up vectors too
            const avgNormInnerRight = averageVec3(right_i, right_i1).uniformScale(-1.0).normalize();
            const avgNormOuterRight = averageVec3(right_i, right_i1).normalize();

            // Calculate vertex normals by averaging face normals
            const n0 = avgNormOuterLeft; // Corner vertex, only one face normal
            const n1 = avgNormOuterLeft.add(avgNormTop).normalize();
            const n2 = avgNormTop.add(avgNormInnerLeft).normalize();
            const n3 = avgNormInnerLeft.add(avgNormTop).normalize(); // Bed uses Top normal
            const n4 = avgNormTop.add(avgNormInnerRight).normalize(); // Bed uses Top normal
            const n5 = avgNormInnerRight.add(avgNormTop).normalize();
            const n6 = avgNormTop.add(avgNormOuterRight).normalize();
            const n7 = avgNormOuterRight; // Corner vertex, only one face normal

            // Append 8 vertices (pos, avg_norm, uv)
            vertices.push(p0.x, p0.y, p0.z, n0.x, n0.y, n0.z, 0, v_i);
            vertices.push(p1.x, p1.y, p1.z, n1.x, n1.y, n1.z, 0, v_i);
            vertices.push(p2.x, p2.y, p2.z, n2.x, n2.y, n2.z, uLip, v_i);
            vertices.push(p3.x, p3.y, p3.z, n3.x, n3.y, n3.z, uLip, v_i);
            vertices.push(p4.x, p4.y, p4.z, n4.x, n4.y, n4.z, uRiver, v_i);
            vertices.push(p5.x, p5.y, p5.z, n5.x, n5.y, n5.z, uRiver, v_i);
            vertices.push(p6.x, p6.y, p6.z, n6.x, n6.y, n6.z, 1, v_i);
            vertices.push(p7.x, p7.y, p7.z, n7.x, n7.y, n7.z, 1, v_i);
        }

        builder.appendVerticesInterleaved(vertices);

        // --- 3. Generate Indices (Simple 8-vertex segments) --- 
        const indices: number[] = [];
        for (let i = 0; i < points.length - 1; i++) {
            const idx = i * vertexCountPerSegment; // Now 8
            const nextIdx = (i + 1) * vertexCountPerSegment; // Now 8

            // Apply consistent CCW winding (ca, nb, na) / (nb, ca, cb) to all faces

            // Outer Left Wall (P0, P1)
            indices.push(idx + 0, nextIdx + 1, nextIdx + 0); // Tri 1: ca, nb, na
            indices.push(nextIdx + 1, idx + 0, idx + 1);     // Tri 2: nb, ca, cb

            // Left Lip Top (P1, P2)
            indices.push(idx + 1, nextIdx + 2, nextIdx + 1); // Tri 1: ca, nb, na
            indices.push(nextIdx + 2, idx + 1, idx + 2);     // Tri 2: nb, ca, cb

            // Inner Left Wall (P2, P3)
            indices.push(idx + 2, nextIdx + 3, nextIdx + 2); // Tri 1: ca, nb, na
            indices.push(nextIdx + 3, idx + 2, idx + 3);     // Tri 2: nb, ca, cb

            // River Bed (P3, P4)
            indices.push(idx + 3, nextIdx + 4, nextIdx + 3); // Tri 1: ca, nb, na
            indices.push(nextIdx + 4, idx + 3, idx + 4);     // Tri 2: nb, ca, cb

            // Inner Right Wall (P4, P5)
            indices.push(idx + 4, nextIdx + 5, nextIdx + 4); // Tri 1: ca, nb, na
            indices.push(nextIdx + 5, idx + 4, idx + 5);     // Tri 2: nb, ca, cb

            // Right Lip Top (P5, P6)
            indices.push(idx + 5, nextIdx + 6, nextIdx + 5); // Tri 1: ca, nb, na
            indices.push(nextIdx + 6, idx + 5, idx + 6);     // Tri 2: nb, ca, cb

            // Outer Right Wall (P6, P7)
            indices.push(idx + 6, nextIdx + 7, nextIdx + 6); // Tri 1: ca, nb, na
            indices.push(nextIdx + 7, idx + 6, idx + 7);     // Tri 2: nb, ca, cb
        }

        builder.appendIndices(indices);

        // --- 4. Finalize Mesh --- 
        if (!builder.isValid()) {
            print("RiverMeshGenerator: MeshBuilder state is invalid before finalizing.");
            return null;
        }

        builder.updateMesh();

        print(`RiverMeshGenerator: Generated smooth mesh with ${vertices.length / (3+3+2)} vertices and ${indices.length / 3} triangles.`);
        return builder.getMesh();
    }

} 