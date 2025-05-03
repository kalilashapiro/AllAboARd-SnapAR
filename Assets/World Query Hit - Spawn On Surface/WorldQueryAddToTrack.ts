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
        if (results === null) {
            this.targetObject.enabled = false;
        } else {
            const hitNormal = results.normal;

            // --- Check if the surface is horizontal enough ---
            const upDot = hitNormal.normalize().dot(vec3.up());
            const horizontalThreshold = 0.9; // Adjust this value (closer to 1 means more strictly horizontal)

            if (upDot < horizontalThreshold) {
                // Surface is too vertical, ignore this hit and disable the target object
                this.targetObject.enabled = false;
                // print("WorldQueryAddToTrack: Hit ignored - surface too vertical (Normal: " + hitNormal.toString() + ", Dot: " + upDot + ")");
                return; // Stop processing this hit result
            }
            // --- End surface check ---

            // If we reach here, the surface is horizontal enough
            this.targetObject.enabled = true;

            //get hit information
            const hitPosition = results.position;

            //identifying the direction the object should look at based on the normal of the hit location.


            var lookDirection;
            if (1 - Math.abs(hitNormal.normalize().dot(vec3.up())) < EPSILON) {
                lookDirection = vec3.forward();
            } else {
                lookDirection = hitNormal.cross(vec3.up());
            }


            const toRotation = quat.lookAt(lookDirection, hitNormal);
            //set position and rotation
            this.targetObject.getTransform().setWorldPosition(hitPosition);
            this.targetObject.getTransform().setWorldRotation(toRotation);


            if (
                this.primaryInteractor.previousTrigger !== InteractorTriggerType.None &&
                this.primaryInteractor.currentTrigger === InteractorTriggerType.None
            ) {
                // Called when a trigger ends
                // print("WorldQueryAddToTrack: Trigger detected (pinch/click release)");

                // --- Call River Path Controller Directly ---
                if (this.riverController) {
                    // print("WorldQueryHitExample: Calling riverController.addPoint directly.");
                    this.riverController.addPoint(hitPosition);
                } else {
                    // print("WorldQueryHitExample: Error - RiverController input is not set in the Inspector!");
                }
                // --- End direct call ---


                // Copy the plane/axis object
                // let parent = this.objectsToSpawn[this.indexToSpawn].getParent(); // Use prefabToSpawn
                // let newObject = parent.copyWholeHierarchy(this.objectsToSpawn[this.indexToSpawn]); // Use prefabToSpawn
                let parent = this.prefabToSpawn.getParent();
                let newObject = parent.copyWholeHierarchy(this.prefabToSpawn);
                newObject.setParentPreserveWorldTransform(null);
            }
        }
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
