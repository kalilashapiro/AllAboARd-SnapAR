// import required modules
const WorldQueryModule = require("LensStudio:WorldQueryModule")
const SIK = require("SpectaclesInteractionKit/SIK").SIK;
const InteractorTriggerType = require("SpectaclesInteractionKit/Core/Interactor/Interactor").InteractorTriggerType;
const EPSILON = 0.01;

// Import the RiverPathController to use its type
import { RiverPathController } from "../RiverGeneration/RiverPathController"; // Adjust path if necessary

@component
export class NewScript extends BaseScriptComponent {

    private primaryInteractor;
    private hitTestSession: HitTestSession;
    private transform: Transform;
    // @input
    // indexToSpawn: number; // Removed indexToSpawn

    @input
    targetObject: SceneObject;

    // @input
    // objectsToSpawn: SceneObject[]; // Replaced with prefabToSpawn
    @input
    prefabToSpawn: SceneObject; // Added single prefab input

    @input
    filterEnabled: boolean;

    // Input to link the RiverPathController script
    @input
    riverController: RiverPathController;

    // Input for the World Mesh object to disable
    @input
    worldMeshObject: SceneObject;

    onAwake() {
        // create new hit session
        this.hitTestSession = this.createHitTestSession(this.filterEnabled);
        if (!this.sceneObject) {
            // print("Please set Target Object input");
            return;
        }
        this.transform = this.targetObject.getTransform();
        // disable target object when surface is not detected
        this.targetObject.enabled = false;
        // this.setObjectEnabled(this.indexToSpawn) // Removed call to setObjectEnabled
        // create update event
        this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this));
    }

    createHitTestSession(filterEnabled) {
        // create hit test session with options
        var options = HitTestSessionOptions.create();
        options.filter = filterEnabled;


        var session = WorldQueryModule.createHitTestSessionWithOptions(options);
        return session;
    }

    onHitTestResult(results) {
        // Make threshold accessible within the function scope
        const horizontalThreshold = 0.9; 

        if (results === null) {
            this.targetObject.enabled = false;
        } else {
            const hitNormal = results.normal;

            // --- Check if the surface is horizontal enough ---
            const upDot = hitNormal.normalize().dot(vec3.up());
            // const horizontalThreshold = 0.9; // Adjust this value (closer to 1 means more strictly horizontal)

            if (upDot < horizontalThreshold) {
                // Surface is too vertical, keep target object oriented but disabled for placement preview
                // We still might want to trigger on it, so don't return early, just disable preview.
                this.targetObject.enabled = false; 
                // Update orientation even if disabled, so the check during trigger works
                this.updateTargetOrientation(results.position, hitNormal); 
            } else {
                 // If we reach here, the surface is horizontal enough
                this.targetObject.enabled = true;
                // Update orientation
                this.updateTargetOrientation(results.position, hitNormal); 
            }
            // --- End surface check ---
            
            // //get hit information // Already defined above
            // const hitPosition = results.position; 

            // //identifying the direction the object should look at based on the normal of the hit location. // Moved to helper
            // ... orientation logic ...
            // //set position and rotation // Moved to helper
            // this.targetObject.getTransform().setWorldPosition(hitPosition);
            // this.targetObject.getTransform().setWorldRotation(toRotation);


            if (
                this.primaryInteractor.previousTrigger !== InteractorTriggerType.None &&
                this.primaryInteractor.currentTrigger === InteractorTriggerType.None
            ) {
                // Called when a trigger ends

                // --- Check surface angle AT TRIGGER time --- 
                const currentHitNormal = this.targetObject.getTransform().getWorldRotation().multiplyVec3(vec3.up()); // Get normal from target orientation
                const currentUpDot = currentHitNormal.normalize().dot(vec3.up());
                
                // Decide action based on surface angle
                if (currentUpDot < horizontalThreshold) {
                    // Triggered on a Wall or non-horizontal surface
                    print("Wall pressed!"); // User requested print statement
                    
                    // Destroy World Mesh if assigned
                    if (this.worldMeshObject) {
                        print("Destroying World Mesh Object: " + this.worldMeshObject.name);
                        this.worldMeshObject.destroy(); // Use destroy()
                    }

                    // Destroy this script's object
                    // Important: Get reference BEFORE destroying
                    const selfObject = this.getSceneObject(); 
                    print("Destroying World Query Object: " + selfObject.name);
                    selfObject.destroy(); // Use destroy()
                    
                    // Do NOT add point or spawn object
                    // No need to return here, as destroying selfObject stops further script execution anyway
                } else {
                    // Triggered on a horizontal surface - Perform normal action
                    // print("WorldQueryAddToTrack: Triggered on horizontal surface"); // Optional log
                    
                    // --- Call River Path Controller Directly ---
                    if (this.riverController) {
                        this.riverController.addPoint(results.position); // Use hitPosition from the hit test result
                    } else {
                        // print("WorldQueryHitExample: Error - RiverController input is not set in the Inspector!");
                    }
                    // --- End direct call ---

                    // Copy the object
                    let parent = this.prefabToSpawn.getParent();
                    let newObject = parent.copyWholeHierarchy(this.prefabToSpawn);
                    newObject.setParentPreserveWorldTransform(null);
                }
                // --- End surface angle check --- 
            }
        }
    }

    // Helper function to update target object's position and rotation
    updateTargetOrientation(position: vec3, normal: vec3) {
        var lookDirection;
        if (1 - Math.abs(normal.normalize().dot(vec3.up())) < EPSILON) {
            lookDirection = vec3.forward();
        } else {
            lookDirection = normal.cross(vec3.up());
        }
        const toRotation = quat.lookAt(lookDirection, normal);
        this.targetObject.getTransform().setWorldPosition(position);
        this.targetObject.getTransform().setWorldRotation(toRotation);
    }

    onUpdate() {
        this.primaryInteractor = SIK.InteractionManager.getTargetingInteractors().shift();


        if (this.primaryInteractor &&
            this.primaryInteractor.isActive() &&
            this.primaryInteractor.isTargeting()
        ) {
            const rayStartOffset = new vec3(this.primaryInteractor.startPoint.x, this.primaryInteractor.startPoint.y, this.primaryInteractor.startPoint.z + 30);
            const rayStart = rayStartOffset;
            const rayEnd = this.primaryInteractor.endPoint;

            // --- Add detailed interactor logging --- 
            // print(`WorldQueryAddToTrack: Interactor Update - Active: ${this.primaryInteractor.isActive()}, Targeting: ${this.primaryInteractor.isTargeting()}`);
            // print(`WorldQueryAddToTrack: Interactor Update - StartPoint: ${this.primaryInteractor.startPoint.toString()}, EndPoint: ${this.primaryInteractor.endPoint.toString()}`);
            // print(`WorldQueryAddToTrack: Interactor Update - RayStart: ${rayStart.toString()}, RayEnd: ${rayEnd.toString()}`);
            // // --- End detailed logging ---

            this.hitTestSession.hitTest(rayStart, rayEnd, this.onHitTestResult.bind(this));

        } else {
            this.targetObject.enabled = false;
            // print("WorldQueryAddToTrack: Interactor inactive - Hit test paused");
        }
    }

    // setObjectIndex(i) { // Removed setObjectIndex method
    //     this.indexToSpawn = i;
    // }

    // setObjectEnabled(i) { // Removed setObjectEnabled method
    //     for (let i = 0; i < this.objectsToSpawn.length; i++)
    //         this.objectsToSpawn[i].enabled = i == this.indexToSpawn;
    // }
}
