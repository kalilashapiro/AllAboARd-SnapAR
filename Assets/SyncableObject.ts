import { SyncEntity } from "./SpectaclesSyncKit/Core/SyncEntity";
import { StorageProperty } from "./SpectaclesSyncKit/Core/StorageProperty";

@component
export class SyncableObject extends BaseScriptComponent {
    // The transform of this object
    transform: Transform = this.getTransform();

    // The SyncEntity that will handle synchronization
    syncEntity: SyncEntity;

    // Storage property for position
    positionProp = StorageProperty.manualVec3("position", this.transform.getLocalPosition());

    // Initialize the sync entity
    initialize() {
        // Create a SyncEntity for this object
        this.syncEntity = new SyncEntity(this);

        // Add position as a property to sync
        this.syncEntity.addStorageProperty(this.positionProp);

        // Set up callback when position changes
        this.positionProp.onAnyChange.add((newPos, oldPos) => {
            this.transform.setLocalPosition(newPos);
        });

        //print(SyncableObject initialized: ${this.getSceneObject().name});
    }

    // Update the position when it changes locally
    updatePosition(newPosition: vec3) {
        // Only update if we own this object
        if (this.syncEntity.doIOwnStore()) {
            this.positionProp.setPendingValue(newPosition);
        }
    }

    onAwake() {
        // Nothing needed here - initialization happens via initialize() call
    }
}