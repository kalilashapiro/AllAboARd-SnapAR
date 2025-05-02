import { InteractableManipulation } from "./SpectaclesSyncKit/SpectaclesInteractionKit/Components/Interaction/InteractableManipulation/InteractableManipulation";

@component
export class NewScript extends BaseScriptComponent {

    @input
    sphereManipulation1: InteractableManipulation

    @input
    sphereManipulation2: InteractableManipulation

    isSphere1IsManipulated: boolean = false
    isSphere2IsManipulated: boolean = false

    onAwake() {

        this.sphereManipulation1.onManipulationStart.add(()=>{
            this.isSphere1IsManipulated = true
        })
        this.sphereManipulation2.onManipulationStart.add(()=>{
            this.isSphere2IsManipulated = true
        })

        this.createEvent("UpdateEvent").bind(()=>{ 
            this.checkBothSphere()
        })
    }
    
    checkBothSphere(){
        if(this.isSphere1IsManipulated && this.isSphere2IsManipulated){
            print("Both spheres are manipulated")
        }
    }
}
