import { SyncEntity } from "SpectaclesSyncKit/Core/SyncEntity";
import { StorageProperty } from "SpectaclesSyncKit/Core/StorageProperty";

@component
export class HandController_TS extends BaseScriptComponent {
    @input 
    controllerJS: ScriptComponent

    transform: Transform = this.getTransform()
    body: BodyComponent = this.getSceneObject().getComponent("Physics.BodyComponent")
    syncEntity: SyncEntity

    getXPosition() {
        return this.transform.getLocalPosition().x
    }

    getYPosition() {
        return this.transform.getLocalPosition().y
    }

    getZPosition() {
        return this.transform.getLocalPosition().z
    }

    setPositionX(x: number) {
        let position = this.transform.getLocalPosition()
        position.x = x
        this.transform.setLocalPosition(position)
    }

    setPositionY(y: number) {
        let position = this.transform.getLocalPosition()
        position.y = y
        this.transform.setLocalPosition(position)
    }

    setPositionZ(z: number) {
        let position = this.transform.getLocalPosition()
        position.z = z
        this.transform.setLocalPosition(position)
    }
    
    onAwake() {
        if (this.controllerJS.getSceneObject().enabled) {
            print("Javascript controller is enabled, skipping initialization")
            return;
        }
        this.syncEntity = new SyncEntity(this)
        this.syncEntity.addStorageProperty(StorageProperty.autoFloat("posX", () => this.getXPosition(), (x: number) => this.setPositionX(x)))
        this.syncEntity.addStorageProperty(StorageProperty.autoFloat("posY", () => this.getYPosition(), (y: number) => this.setPositionY(y)))
        this.syncEntity.addStorageProperty(StorageProperty.autoFloat("posZ", () => this.getZPosition(), (z: number) => this.setPositionZ(z)))
        print("Paddle initialized")
    }
}
