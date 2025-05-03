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
        this.addPoint(new vec3(0, 0, -100));
        this.addPoint(new vec3(50, 0, -150));
        this.addPoint(new vec3(0, 0, -200));
        this.addPoint(new vec3(-50, 0, -250));
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
     * Regenerates the river mesh based on the current path points.
     */
    public regenerateMesh(): void {
        if (!this.riverMeshVisual) {
            print("RiverPathController: RiverMeshVisual input is not set.");
            return;
        }

        if (this.pathPoints.length < 2) {
            // Clear the mesh if there are not enough points to form a segment
            this.riverMeshVisual.mesh = null;
            print("RiverPathController: Not enough points to generate mesh, clearing visual.");
            return;
        }

        const newMesh = RiverMeshGenerator.buildRiverMesh(
            this.pathPoints,
            this.riverWidth,
            this.lipHeight,
            this.lipWidth
        );

        if (newMesh) {
            this.riverMeshVisual.mesh = newMesh;
            print(`RiverPathController: Mesh regenerated with ${this.pathPoints.length} points.`);
        } else {
            this.riverMeshVisual.mesh = null; // Clear mesh if generation failed
            print("RiverPathController: Mesh generation failed, clearing visual.");
        }
    }
} 