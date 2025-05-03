// Removed import { ScriptComponent, component, input, RenderMeshVisual, vec3, TouchEvent, TouchEventType, screen } from "@snap/lenstudio-scripting";
import { RiverMeshGenerator } from "./RiverMeshGenerator";

@component
export class RiverPathController extends BaseScriptComponent {
    // Removing custom static getTypeName again, following LoopController example
    // and previous analysis. Linter error TS1238 should be ignored.

    @input
    riverMeshVisual: RenderMeshVisual;

    // Remove input for the camera as it's no longer needed for placing points
    // @input
    // cameraObject: SceneObject;

    @input
    riverWidth: number = 30.0;

    @input
    lipHeight: number = 5.0;

    @input
    lipWidth: number = 10.0;

    @input
    subdivisionCount: number = 8; // Number of segments per original segment

    @input
    maxYDifferenceFromStart: number = -1; // Max allowed Y diff (height) from first point. <= 0 means disabled.

    @input
    clickDistanceThreshold: number = 15.0; // Distance to trigger delete last or close loop.

    // Optional: Use world tracking for placing points
    // @input
    // worldTrackingComponent: WorldTrackingComponent;

    private pathPoints: vec3[] = [];
    private isLoop: boolean = false; // Flag to indicate if the path should loop

    start() {
        // Initialize with a simple default path for testing
        this.initializeDefaultPath();

        // Event listener removed - points are now added via direct call
        // script.registerEventHandler("AddWorldPointToRiver", this.onWorldPointReceived);

        // Remove touch event listeners
        // this.createEvent("TouchStartEvent").bind(this.onTouchStart);
        // this.createEvent("TouchEndEvent").bind(this.onTouchEnd);
        // this.createEvent("TouchMoveEvent").bind(this.onTouchMove); // Handle move to reset flag
    }

    initializeDefaultPath() {
        this.clearPoints(); // Clear any existing points
        // Add a few default points (e.g., a simple line or curve)
        // More points needed for Catmull-Rom visualization
        this.addPoint(new vec3(0, 0, -100));
        this.addPoint(new vec3(50, 5, -150));  // Added slight height variation
        this.addPoint(new vec3(0, 0, -200));
        this.addPoint(new vec3(-50, -5, -250)); // Added slight height variation
        this.addPoint(new vec3(0, 0, -300));
        print("RiverPathController: Initialized with default path.");
    }

    // --- Removed method for handling events ---
    /*
    onWorldPointReceived(position: vec3) {
        if (position && position instanceof vec3) {
            print(`RiverPathController: Received world point: ${position.toString()}`);
            this.addPoint(position);
        } else {
            print("RiverPathController: Received invalid data on AddWorldPointToRiver event.");
        }
    }
    */
    // --- End removed method ---

    // Removed touch event handlers (onTouchStart, onTouchEnd, onTouchMove, addPointFromTouch)
    /*
    // Revert to TouchStartEvent type for handler signature
    onTouchStart(event: TouchStartEvent) {
        print("RiverPathController: Touch Start / Mouse Down detected.");
        this.touchStarted = true;
    }

    // Revert to TouchEndEvent type for handler signature
    onTouchEnd(event: TouchEndEvent) {
        print("RiverPathController: onTouchEnd triggered.");
        if (this.touchStarted) {
            this.touchStarted = false; // Reset flag
            // Revert to event.getTouchPosition() for TouchEndEvent
            this.addPointFromTouch(event.getTouchPosition());
        }
    }

    // Revert to TouchMoveEvent type for handler signature
    onTouchMove(event: TouchMoveEvent) {
        // If finger moves, it's not a simple tap, reset the flag
        this.touchStarted = false;
    }

    addPointFromTouch(screenPos: vec2) {
        // TODO: Replace this with World Mesh Query or Plane Detection Raycast
        // For now, just adds a point relative to the camera direction.
        if (!this.cameraObject) {
            print("RiverPathController: Camera Object input is not set in the Inspector.");
            return;
        }
        try {
            // Use the cameraObject input
            const camTransform = this.cameraObject.getTransform();
            const worldPos = camTransform.getWorldPosition().add(camTransform.forward.uniformScale(200)); // Example: 200 units forward
            print(`RiverPathController: Adding point near ${worldPos.toString()} from touch.`);
            this.addPoint(worldPos);
        } catch (e) {
            print(`RiverPathController: Error getting camera transform or adding point: ${e}`)
        }
    }
    */

    /**
     * Adds a new point to the end of the river path.
     * @param point The world space coordinate to add.
     */
    public addPoint(point: vec3): void {
        // 1. Check Height Constraint
        if (this.pathPoints.length > 0 && this.maxYDifferenceFromStart > 0) {
            const firstPointY = this.pathPoints[0].y;
            const newPointY = point.y;
            const yDifference = Math.abs(newPointY - firstPointY);
            if (yDifference > this.maxYDifferenceFromStart) {
                print(`RiverPathController: Point Y (${newPointY.toFixed(2)}) too different from start Y (${firstPointY.toFixed(2)}). Max diff: ${this.maxYDifferenceFromStart.toFixed(2)}. Point not added.`);
                return; // Stop here, don't add the point
            }
        }

        const numPoints = this.pathPoints.length;
        const thresholdSq = this.clickDistanceThreshold * this.clickDistanceThreshold; // Use squared distance for efficiency

        // 2. Check for Deleting Last Point
        if (numPoints > 0) {
            const lastPoint = this.pathPoints[numPoints - 1];
            const distSqToLast = point.distanceSquared(lastPoint);
            if (distSqToLast < thresholdSq) {
                print(`RiverPathController: Click too close to last point (${lastPoint.toString()}). Deleting last point.`);
                this.pathPoints.pop();
                this.isLoop = false; // Deleting breaks loop
                this.regenerateMesh();
                return;
            }
        }

        // 3. Check for Closing Loop
        if (numPoints >= 3 && !this.isLoop) { // Can only close if >= 3 points and not already a loop
            const firstPoint = this.pathPoints[0];
            const distSqToFirst = point.distanceSquared(firstPoint);
            if (distSqToFirst < thresholdSq) {
                print(`RiverPathController: Click too close to first point (${firstPoint.toString()}). Closing loop.`);
                this.isLoop = true;
                this.regenerateMesh();
                return; // Don't add the point that triggered the loop closure
            }
        }

        // 4. Add Point Normally
        print(`RiverPathController: Adding point ${point.toString()}`);
        this.pathPoints.push(point);
        // Adding a new point always breaks the loop unless it's the point triggering the closure (handled above)
        if (this.isLoop) {
             print("RiverPathController: Adding point broke the loop.");
             this.isLoop = false;
        }
        this.regenerateMesh();
    }

    /**
     * Clears all points from the path and resets the mesh.
     */
    public clearPoints(): void {
        this.pathPoints = [];
        this.isLoop = false; // Reset loop flag
        this.regenerateMesh(); // Regenerate will clear the mesh visual
        print("RiverPathController: Path points cleared.");
    }

    /**
     * Regenerates the river mesh based on the current path points,
     * applying Catmull-Rom interpolation and subdivision.
     */
    public regenerateMesh(): void {
        if (!this.riverMeshVisual) {
            print("RiverPathController: RiverMeshVisual input is not set.");
            return;
        }

        const pointsToUse: vec3[] = [];
        const numPoints = this.pathPoints.length;

        if (numPoints < 2) {
            this.riverMeshVisual.mesh = null;
            print("RiverPathController: Not enough points for any mesh.");
            return;
        }

        const subdivisions = Math.max(1, this.subdivisionCount); // Ensure at least 1 subdivision

        // Removed check for numPoints < 4. Always generate spline if points >= 2.
        // The CatmullRom logic with endpoint duplication handles fewer points.
        print(`RiverPathController: Generating spline from ${numPoints} points. Loop: ${this.isLoop}. Subdivisions: ${subdivisions}.`);

        const numSegments = this.isLoop ? numPoints : numPoints - 1;
        if (numSegments <= 0) { // Need at least one segment
             pointsToUse.push(...this.pathPoints); // Fallback for safety, though numPoints<2 handled above
        } else {
             // Loop through the segments that define the curve.
            for (let i = 0; i < numSegments; i++) {
                // Determine control points p0, p1, p2, p3
                let p0, p1, p2, p3;
                if (this.isLoop) {
                    // Use modulo arithmetic for seamless looping
                    p0 = this.pathPoints[(i - 1 + numPoints) % numPoints];
                    p1 = this.pathPoints[i % numPoints];
                    p2 = this.pathPoints[(i + 1) % numPoints];
                    p3 = this.pathPoints[(i + 2) % numPoints];
                } else {
                    // Duplicate endpoints for non-looping spline
                    p0 = (i === 0) ? this.pathPoints[0] : this.pathPoints[i - 1];
                    p1 = this.pathPoints[i];
                    p2 = this.pathPoints[i + 1];
                    p3 = (i + 2 >= numPoints) ? this.pathPoints[numPoints - 1] : this.pathPoints[i + 2];
                }

                // Add the starting point of the segment (p1) only once at the beginning
                if (i === 0) {
                    pointsToUse.push(p1);
                }

                // Subdivide the curve segment between p1 and p2
                for (let j = 1; j <= subdivisions; j++) {
                    const t = j / subdivisions;
                    const point = this.catmullRom(p0, p1, p2, p3, t);
                    pointsToUse.push(point);
                }
            }
        }

        if (pointsToUse.length < 2) {
            this.riverMeshVisual.mesh = null;
            print("RiverPathController: Interpolation resulted in too few points, clearing visual.");
            return;
        }

        // Generate mesh with the (potentially) interpolated points
        const newMesh = RiverMeshGenerator.buildRiverMesh(
            pointsToUse,
            this.riverWidth,
            this.lipHeight,
            this.lipWidth,
            this.isLoop
        );

        if (newMesh) {
            this.riverMeshVisual.mesh = newMesh;
            print(`RiverPathController: Mesh regenerated with ${pointsToUse.length} interpolated points.`);
        } else {
            this.riverMeshVisual.mesh = null; // Clear mesh if generation failed
            print("RiverPathController: Mesh generation failed after interpolation, clearing visual.");
        }
    }

    // Helper function for Catmull-Rom interpolation
    private catmullRom(p0: vec3, p1: vec3, p2: vec3, p3: vec3, t: number): vec3 {
        const t2 = t * t;
        const t3 = t2 * t;

        // Using temporary vectors for intermediate calculations
        let term1 = p1.uniformScale(2.0);
        let term2 = p2.sub(p0).uniformScale(t);
        let term3 = p0.uniformScale(2.0).sub(p1.uniformScale(5.0)).add(p2.uniformScale(4.0)).sub(p3).uniformScale(t2);
        let term4 = p0.uniformScale(-1.0).add(p1.uniformScale(3.0)).sub(p2.uniformScale(3.0)).add(p3).uniformScale(t3);

        // Sum terms: 0.5 * (term1 + term2 + term3 + term4)
        const sum = term1.add(term2).add(term3).add(term4);
        const out = sum.uniformScale(0.5);

        return out;
    }
} 