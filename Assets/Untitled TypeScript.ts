import { SyncEntity } from "SpectaclesSyncKit/Core/SyncEntity";
import { StorageProperty } from "SpectaclesSyncKit/Core/StorageProperty";

@component
export class HandController_TS extends BaseScriptComponent {
    @input 
    controllerJS: ScriptComponent

    transform: Transform = this.getTransform()
    body: BodyComponent = this.getSceneObject().getComponent("Physics.BodyComponent")
    syncEntity: SyncEntity
    
    onAwake() {

    }
}
