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

    isSphere1IsManipulated: boolean = false
    isSphere2IsManipulated: boolean = false

    onAwake() {
        // Use onTriggerStart to set the boolean to true when the sphere is pinched
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
    }
    
    checkBothSphere(){
        if(this.isSphere1IsManipulated && this.isSphere2IsManipulated){
            print("Both spheres are manipulated")
            this.updateBoatPosition()
        }
    }

    updateBoatPosition() {
        if (!this.boatPrefab) {
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
        
        // Update only the X and Z coordinates of the boat, keeping its Y position unchanged
        boatTransform.setWorldPosition(new vec3(centerX, boatPosition.y, centerZ));
    }
}

