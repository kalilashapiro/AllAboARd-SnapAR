import { Interactable } from "./SpectaclesSyncKit/SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable";
import { InteractableManipulation } from "./SpectaclesSyncKit/SpectaclesInteractionKit/Components/Interaction/InteractableManipulation/InteractableManipulation";

@component
export class Rope extends BaseScriptComponent {

    @input
    sphereManipulation1: Interactable

    @input
    boatPrefab: SceneObject

    @input
    sphereManipulation2: Interactable

    @input
    movementSpeed: number = 0.01  // Speed at which the boat moves forward

    forwardDirection: vec3 = new vec3(0, 0, 1)  // Default forward direction (along Z-axis)
    lastUpdateTime: number = 0  // To track time for smooth movement



    isSphere1IsManipulated: boolean = false
    isSphere2IsManipulated: boolean = false

    onAwake() {
        print("on awake - rope.ts")

        // Set the boat's initial position to match the rope's position
        if (this.boatPrefab) {
            const ropePosition = this.getTransform().getWorldPosition();
            const boatTransform = this.boatPrefab.getTransform();
            const boatPosition = boatTransform.getWorldPosition();
                
            // Update only X and Z coordinates, keeping the boat's Y position
            boatTransform.setWorldPosition(new vec3(ropePosition.x, boatPosition.y, ropePosition.z));
            print("Initialized boat position to rope position");
            } 
        else {
            print("Boat prefab not assigned");
        }        

        
        // Use onTriggerS"tart to set the boolean to true when the sphere is pinched
        this.createEvent("OnStartEvent").bind(()=> {
            this.sphereManipulation1.onTriggerStart.add((event) => {
                this.isSphere1IsManipulated = true
                print("sphere 1 manipulated")
            });

            // Use onTriggerEnd to set the boolean to false when the sphere is released
            this.sphereManipulation1.onTriggerEnd.add((event) => {
                this.isSphere1IsManipulated = false
                print("sphere 1 released")
            });
        
            // Same for sphere 2
            this.sphereManipulation2.onTriggerStart.add((event) => {
                this.isSphere2IsManipulated = true
                print("sphere 2 manipulated")
            });
        
            this.sphereManipulation2.onTriggerEnd.add((event) => {
                this.isSphere2IsManipulated = false
                print("sphere 2 released")
            });   

        this.createEvent("UpdateEvent").bind(()=>{ 
            this.checkBothSphere()
        })

        });


    }
    
    checkBothSphere(){
        if(this.isSphere1IsManipulated && this.isSphere2IsManipulated){
            print("Both spheres are manipulated")
            this.updateBoatPosition()
        }
    }

    updateBoatPosition() {
        if (!this.boatPrefab) {
            print("boat not found")
            return; // Exit if boat reference is not set
        }
        
        // Get the positions of both spheres
        const sphere1Position = this.sphereManipulation1.getTransform().getWorldPosition();
        const sphere2Position = this.sphereManipulation2.getTransform().getWorldPosition();
        
        // Calculate the center position (average of the two sphere positions)
        const centerX = (sphere1Position.x + sphere2Position.x) / 2;
        const centerZ = (sphere1Position.z + sphere2Position.z) / 2;
        
        // Get the current boat position
        const boatTransform = this.boatPrefab.getTransform();
        const boatPosition = boatTransform.getWorldPosition();
        
        // Calculate movement distance based on speed and time
        const moveDistance = this.movementSpeed * getDeltaTime();
        
        // Calculate new position: center position from spheres + forward movement
        const newX = centerX + (this.forwardDirection.x * moveDistance);
        const newZ = centerZ + (this.forwardDirection.z * moveDistance);
        
        // Update the boat position, keeping its Y coordinate unchanged
        boatTransform.setWorldPosition(new vec3(newX, boatPosition.y, newZ));
    }
}

