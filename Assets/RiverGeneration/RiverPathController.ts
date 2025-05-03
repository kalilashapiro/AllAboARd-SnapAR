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

    // Optional: Use world tracking for placing points
    // @input
    // worldTrackingComponent: WorldTrackingComponent;

    private pathPoints: vec3[] = [];
    // Removed touchStarted flag
    // private touchStarted: boolean = false;

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
        // Check Y difference constraint if enabled and not the first point
        if (this.pathPoints.length > 0 && this.maxYDifferenceFromStart > 0) {
            const firstPointY = this.pathPoints[0].y;
            const newPointY = point.y;
            const yDifference = Math.abs(newPointY - firstPointY);

            if (yDifference > this.maxYDifferenceFromStart) {
                print(`RiverPathController: Point Y (${newPointY.toFixed(2)}) too different from start Y (${firstPointY.toFixed(2)}). Max diff: ${this.maxYDifferenceFromStart.toFixed(2)}. Point not added.`);
                return; // Stop here, don't add the point
            }
        }

        // If constraint passed or doesn't apply, add the point
        this.pathPoints.push(point);
        this.regenerateMesh();
    }

    /**
     * Clears all points from the path and resets the mesh.
     */
    public clearPoints(): void {
        this.pathPoints = [];
        this.regenerateMesh();
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

        if (numPoints < 2) { // Redundant check, but safe
            this.riverMeshVisual.mesh = null;
            return;
        } else if (numPoints < 4) { // Not enough points for Catmull-Rom, use original points as straight segments
            print(`RiverPathController: Using ${numPoints} original points (not enough for Catmull-Rom).`);
            pointsToUse.push(...this.pathPoints);
        } else { // Enough points for Catmull-Rom
            print(`RiverPathController: Generating spline from ${numPoints} points with ${subdivisions} subdivisions.`);
            // Loop through the segments where Catmull-Rom can be calculated.
            // The curve segment is generated between p1 and p2.
            // i is the index of p1.
            for (let i = 0; i < numPoints - 1; i++) {
                // Determine control points, duplicating endpoints as necessary
                const p0 = (i === 0) ? this.pathPoints[0] : this.pathPoints[i - 1];
                const p1 = this.pathPoints[i];
                const p2 = this.pathPoints[i + 1];
                const p3 = (i + 2 >= numPoints) ? this.pathPoints[numPoints - 1] : this.pathPoints[i + 2];

                // Add p1 (start of segment) only for the first segment
                if (i === 0) {
                    pointsToUse.push(p1);
                }

                 // Subdivide the curve segment between p1 and p2
                 // Starts from j=1 because t=0 corresponds to p1
                for (let j = 1; j <= subdivisions; j++) {
                     const t = j / subdivisions;
                     const point = this.catmullRom(p0, p1, p2, p3, t);
                     pointsToUse.push(point); // Add the interpolated point
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
            this.lipWidth
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