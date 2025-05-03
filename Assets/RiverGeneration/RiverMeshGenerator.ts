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
     * @param isLoop (Optional) Whether the path forms a closed loop. Defaults to false.
     * @param relaxationIterations (Optional) Number of smoothing iterations for silhouette banks.
     * @param relaxationFactor (Optional) Strength of smoothing (0-1).
     * @param waterLevelOffset (Optional) Vertical offset of water surface from river bed.
     * @param waterWidthExpansion (Optional) Horizontal expansion of water surface into banks.
     * @returns A tuple [RenderMesh | null, RenderMesh | null] for [river, water].
     */
    export function buildRiverMesh(points: vec3[], riverWidth: number, lipHeight: number, lipWidth: number, 
                                 isLoop: boolean = false, 
                                 relaxationIterations: number = 0, 
                                 relaxationFactor: number = 0.5,
                                 waterLevelOffset: number = 0.0, 
                                 waterWidthExpansion: number = 0.0): [RenderMesh | null, RenderMesh | null] {
        
        // --- Debug: Print received parameters --- 
        print(`RiverMeshGenerator: Received params - waterLevelOffset: ${waterLevelOffset}, waterWidthExpansion: ${waterWidthExpansion}`);
        // --- End Debug --- 
        
        if (points.length < 2 || riverWidth <= 0 || lipHeight < 0 || lipWidth < 0) {
            print("RiverMeshGenerator: Invalid input parameters.");
            return [null, null]; // Not enough points or invalid dimensions
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

        // --- 2. Calculate Initial Silhouette Vertices --- 
        const numPoints = points.length;
        // Store initial positions per bank [bankIndex][pointIndex]
        const initialBankPositions: vec3[][] = [[], [], [], [], [], [], [], []]; 
        const initialBankVCoords: number[][] = [[], [], [], [], [], [], [], []]; // Store V coords per bank
        const vertexCountPerSegment = 8; // Still 8 conceptual points per cross-section

        // Pre-calculate segment directions for curvature estimation (used for width scaling)
        const segmentDirections: vec3[] = [];
        for (let i = 0; i < numPoints - 1; i++) {
            segmentDirections.push(points[i + 1].sub(points[i]).normalize());
        }

        // Calculate initial positions based on path and width scaling
        for (let i = 0; i < numPoints; i++) {
            const segment_i = pathSegmentsData[i];
            const p_i = segment_i.point;
            const right_i = segment_i.right;
            const up_i = segment_i.up;

            // --- Width Scaling Calculation (Keep this logic) ---
             let leftScale = 1.0;
             let rightScale = 1.0;
             const minWidthScale = 0.2;
             const straightThreshold = 0.99;
              if (i > 0 && i < numPoints - 1) { 
                  const dir_in = segmentDirections[i - 1]; 
                  const dir_out = segmentDirections[i]; 
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

            // Calculate and store initial positions
            const p0 = p_i.add(right_i.uniformScale(-leftHalfTotalWidth));
            const p1 = p0.add(up_i.uniformScale(lipHeight));
            const p3 = p_i.add(right_i.uniformScale(-leftHalfRiverWidth));
            const p2 = p3.add(up_i.uniformScale(lipHeight));
            const p4 = p_i.add(right_i.uniformScale(rightHalfRiverWidth));
            const p5 = p4.add(up_i.uniformScale(lipHeight));
            const p7 = p_i.add(right_i.uniformScale(rightHalfTotalWidth));
            const p6 = p7.add(up_i.uniformScale(lipHeight));

            initialBankPositions[0].push(p0);
            initialBankPositions[1].push(p1);
            initialBankPositions[2].push(p2);
            initialBankPositions[3].push(p3);
            initialBankPositions[4].push(p4);
            initialBankPositions[5].push(p5);
            initialBankPositions[6].push(p6);
            initialBankPositions[7].push(p7);

            // Calculate initial V coordinates based on distance along each bank
            if (i === 0) {
                for (let bankIdx = 0; bankIdx < 8; bankIdx++) {
                    initialBankVCoords[bankIdx].push(0);
                }
            } else {
                for (let bankIdx = 0; bankIdx < 8; bankIdx++) {
                    const currentPos = initialBankPositions[bankIdx][i];
                    const prevPos = initialBankPositions[bankIdx][i-1];
                    const prevV = initialBankVCoords[bankIdx][i-1];
                    initialBankVCoords[bankIdx].push(prevV + currentPos.distance(prevPos));
                }
            }
        }

        // --- Normalize V Coordinates --- (Optional but Recommended)
        let maxV = 0;
        if (numPoints > 0) {
             for (let bankIdx = 0; bankIdx < 8; bankIdx++) {
                maxV = Math.max(maxV, initialBankVCoords[bankIdx][numPoints - 1]);
            }
        }
        if (maxV > 0) {
            print(`Normalizing V coordinates by max distance: ${maxV.toFixed(2)}`);
            for (let bankIdx = 0; bankIdx < 8; bankIdx++) {
                for (let i = 0; i < numPoints; i++) {
                    initialBankVCoords[bankIdx][i] /= maxV;
                }
            }
        }
        // --- End Normalize V --- 

        // --- 3. Perform Relaxation Smoothing on Silhouette --- 
        let relaxedBankPositions = initialBankPositions; // Start with initial
        const numRelaxIterations = Math.max(0, relaxationIterations);
        const rFactor = clamp(relaxationFactor, 0.0, 1.0);

        if (numRelaxIterations > 0 && numPoints >= 3) { // Need at least 3 points for neighbours
            print(`RiverMeshGenerator: Applying ${numRelaxIterations} relaxation iterations (factor: ${rFactor}).`);
            let currentPositions = initialBankPositions.map(bank => bank.map(p => new vec3(p.x, p.y, p.z))); // Deep copy

            for (let iter = 0; iter < numRelaxIterations; iter++) {
                let nextPositions = currentPositions.map(bank => bank.map(p => new vec3(p.x, p.y, p.z))); // Deep copy for next state

                for (let bankIdx = 0; bankIdx < 8; bankIdx++) {
                     // Determine loop range based on isLoop
                    const startPoint = isLoop ? 0 : 1;
                    const endPoint = isLoop ? numPoints : numPoints - 1;

                    for (let i = startPoint; i < endPoint; i++) {
                        const prevIdx = (i - 1 + numPoints) % numPoints;
                        const nextIdx = (i + 1) % numPoints;

                        const v_prev = currentPositions[bankIdx][prevIdx];
                        const v_curr = currentPositions[bankIdx][i];
                        const v_next = currentPositions[bankIdx][nextIdx];

                        // Target position = midpoint of neighbours
                        const targetPos = v_prev.add(v_next).uniformScale(0.5);
                        
                        // Move current towards target
                        const delta = targetPos.sub(v_curr);
                        const newPos = v_curr.add(delta.uniformScale(rFactor));
                        
                        nextPositions[bankIdx][i] = newPos;
                    }
                }
                currentPositions = nextPositions; // Update positions for next iteration
            }
            relaxedBankPositions = currentPositions; // Final relaxed positions
        } else {
             relaxedBankPositions = initialBankPositions; // No smoothing applied
        }

        // --- 4. Generate Final Vertices using Relaxed Positions --- 
        const riverVertices: number[] = [];
        for (let i = 0; i < numPoints; i++) {
             const p0 = relaxedBankPositions[0][i];
             const p1 = relaxedBankPositions[1][i];
             const p2 = relaxedBankPositions[2][i];
             const p3 = relaxedBankPositions[3][i];
             const p4 = relaxedBankPositions[4][i];
             const p5 = relaxedBankPositions[5][i];
             const p6 = relaxedBankPositions[6][i];
             const p7 = relaxedBankPositions[7][i];

             // Get V coords from the pre-calculated initial (and normalized) bank V arrays
             const v0 = initialBankVCoords[0][i];
             const v1 = initialBankVCoords[1][i];
             const v2 = initialBankVCoords[2][i];
             const v3 = initialBankVCoords[3][i];
             const v4 = initialBankVCoords[4][i];
             const v5 = initialBankVCoords[5][i];
             const v6 = initialBankVCoords[6][i];
             const v7 = initialBankVCoords[7][i];

             // Using original pathSegmentsData for normals
             const segment_i = pathSegmentsData[i];
             const right_i = segment_i.right;
             const up_i = segment_i.up;

             // Estimate face normals by averaging adjacent segment frames
             const avgNormOuterLeft = averageVec3(right_i, right_i).uniformScale(-1.0).normalize();
             const avgNormInnerLeft = averageVec3(right_i, right_i).normalize();
             const avgNormTop = averageVec3(up_i, up_i).normalize(); 
             const avgNormInnerRight = averageVec3(right_i, right_i).uniformScale(-1.0).normalize();
             const avgNormOuterRight = averageVec3(right_i, right_i).normalize();

             // Calculate vertex normals by averaging face normals
             const n0 = avgNormOuterLeft;
             const n1 = avgNormOuterLeft.add(avgNormTop).normalize();
             const n2 = avgNormTop.add(avgNormInnerLeft).normalize();
             const n3 = avgNormInnerLeft.add(avgNormTop).normalize();
             const n4 = avgNormTop.add(avgNormInnerRight).normalize();
             const n5 = avgNormInnerRight.add(avgNormTop).normalize();
             const n6 = avgNormTop.add(avgNormOuterRight).normalize();
             const n7 = avgNormOuterRight;

             // Append 8 vertices (RELAXED pos, avg_norm, BANK-SPECIFIC uv)
            riverVertices.push(p0.x, p0.y, p0.z, n0.x, n0.y, n0.z, 0, v0);       // P0 U=0, V=v0
            riverVertices.push(p1.x, p1.y, p1.z, n1.x, n1.y, n1.z, 0, v1);       // P1 U=0, V=v1
            riverVertices.push(p2.x, p2.y, p2.z, n2.x, n2.y, n2.z, uLip, v2);    // P2 U=uLip, V=v2
            riverVertices.push(p3.x, p3.y, p3.z, n3.x, n3.y, n3.z, uLip, v3);    // P3 U=uLip, V=v3
            riverVertices.push(p4.x, p4.y, p4.z, n4.x, n4.y, n4.z, uRiver, v4);  // P4 U=uRiver, V=v4
            riverVertices.push(p5.x, p5.y, p5.z, n5.x, n5.y, n5.z, uRiver, v5);  // P5 U=uRiver, V=v5
            riverVertices.push(p6.x, p6.y, p6.z, n6.x, n6.y, n6.z, 1, v6);       // P6 U=1, V=v6
            riverVertices.push(p7.x, p7.y, p7.z, n7.x, n7.y, n7.z, 1, v7);       // P7 U=1, V=v7
         }

        builder.appendVerticesInterleaved(riverVertices);

        // --- 5. Generate River Indices (Same as before) ---
        const riverIndices: number[] = [];
        const numSegments = isLoop ? numPoints : numPoints - 1;
        if (numSegments > 0) {
             for (let i = 0; i < numSegments; i++) {
                 const idx = i * vertexCountPerSegment; 
                 const nextIdx = ((i + 1) % numPoints) * vertexCountPerSegment;

                 // CCW winding
                 riverIndices.push(idx + 0, nextIdx + 1, nextIdx + 0); riverIndices.push(nextIdx + 1, idx + 0, idx + 1); 
                 riverIndices.push(idx + 1, nextIdx + 2, nextIdx + 1); riverIndices.push(nextIdx + 2, idx + 1, idx + 2); 
                 riverIndices.push(idx + 2, nextIdx + 3, nextIdx + 2); riverIndices.push(nextIdx + 3, idx + 2, idx + 3); 
                 riverIndices.push(idx + 3, nextIdx + 4, nextIdx + 3); riverIndices.push(nextIdx + 4, idx + 3, idx + 4); 
                 riverIndices.push(idx + 4, nextIdx + 5, nextIdx + 4); riverIndices.push(nextIdx + 5, idx + 4, idx + 5); 
                 riverIndices.push(idx + 5, nextIdx + 6, nextIdx + 5); riverIndices.push(nextIdx + 6, idx + 5, idx + 6); 
                 riverIndices.push(idx + 6, nextIdx + 7, nextIdx + 6); riverIndices.push(nextIdx + 7, idx + 6, idx + 7); 
             }
         }
        builder.appendIndices(riverIndices);

        // --- Generate Water Mesh ---
        let waterMesh: RenderMesh | null = null;
        if (numPoints >= 2 && totalPathLength > 0) {
             print("Generating water surface mesh...");
             let waterBuilder = new MeshBuilder([
                 { name: "position", components: 3 },
                 { name: "normal", components: 3, normalized: true },
                 { name: "texture0", components: 2 }
             ]);
             waterBuilder.topology = MeshTopology.Triangles;
             waterBuilder.indexType = MeshIndexType.UInt16;

            const waterVertices: number[] = [];
             for (let i = 0; i < numPoints; i++) {
                 const p3 = relaxedBankPositions[3][i]; // Inner Left Base
                 const p4 = relaxedBankPositions[4][i]; // Inner Right Base
                 const segment_i = pathSegmentsData[i];
                 const up_i = segment_i.up;
                 const right_i = segment_i.right;
                 const v_water = totalPathLength > 0 ? segment_i.length / totalPathLength : 0;
                 const normWater = up_i; // Water surface normal is up

                 const waterP3 = p3.add(up_i.uniformScale(waterLevelOffset)).add(right_i.uniformScale(-waterWidthExpansion));
                 const waterP4 = p4.add(up_i.uniformScale(waterLevelOffset)).add(right_i.uniformScale(waterWidthExpansion));

                 // --- Debug: Print water vertex calculation ---
                 if (i === 0) { // Print only for the first point to avoid spam
                     print(`  Water Calc (i=0): p3.y=${p3.y.toFixed(2)}, waterLevelOffset=${waterLevelOffset.toFixed(2)}, up_i.y=${up_i.y.toFixed(2)}, waterP3.y=${waterP3.y.toFixed(2)}`);
                 }
                 // --- End Debug ---

                 // Append 2 vertices per point (pos, norm, uv)
                 // Use world XZ coordinates for UVs
                 waterVertices.push(waterP3.x, waterP3.y, waterP3.z, normWater.x, normWater.y, normWater.z, waterP3.x, waterP3.z); // U = worldX, V = worldZ
                 waterVertices.push(waterP4.x, waterP4.y, waterP4.z, normWater.x, normWater.y, normWater.z, waterP4.x, waterP4.z); // U = worldX, V = worldZ
             }
             waterBuilder.appendVerticesInterleaved(waterVertices);

            const waterIndices: number[] = [];
             const waterVertexCountPerSegment = 2;
             if (numSegments > 0) {
                 for (let i = 0; i < numSegments; i++) {
                     const idx = i * waterVertexCountPerSegment;
                     const nextIdx = ((i + 1) % numPoints) * waterVertexCountPerSegment;
                     // CCW winding for quad (P3_i, P4_i, P3_i1, P4_i1)
                     waterIndices.push(idx + 0, nextIdx + 1, nextIdx + 0); // Tri 1: ca(0), nb(1'), na(0')
                     waterIndices.push(nextIdx + 1, idx + 0, idx + 1);     // Tri 2: nb(1'), ca(0), cb(1)
                 }
             }
             waterBuilder.appendIndices(waterIndices);

            if (!waterBuilder.isValid()) {
                 print("RiverMeshGenerator: Water MeshBuilder state is invalid.");
             } else {
                 waterBuilder.updateMesh();
                 waterMesh = waterBuilder.getMesh();
                 print(`RiverMeshGenerator: Generated water mesh with ${waterVertices.length / (3+3+2)} vertices and ${waterIndices.length / 3} triangles.`);
             }
         }
        // --- End Water Mesh ---

        // --- Finalize River Mesh --- 
        let riverMesh: RenderMesh | null = null;
        if (!builder.isValid()) {
            print("RiverMeshGenerator: River MeshBuilder state is invalid before finalizing.");
        } else {
             builder.updateMesh();
             riverMesh = builder.getMesh();
             print(`RiverMeshGenerator: Generated relaxed river mesh (${numRelaxIterations} iterations) with ${riverVertices.length / (3+3+2)} vertices and ${riverIndices.length / 3} triangles.`);
        }
        
        return [riverMesh, waterMesh];
    }

} 