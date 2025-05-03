import { SyncEntity } from "./SpectaclesSyncKit/Core/SyncEntity";
import { StorageProperty } from "./SpectaclesSyncKit/Core/StorageProperty";
import { SessionController } from "./SpectaclesSyncKit/Core/SessionController";

@component
export class HandObjectSync extends BaseScriptComponent {
    // Reference to the hand tracked object (automatically attached to hand)
    @input()
    handObject: SceneObject;
    
    // Is this the local player's hand object?
    @input()
    isLocalHand: boolean = true;
    
    // The transform of the tracked object
    transform: Transform;
    
    // The SyncEntity for network communication
    syncEntity: SyncEntity;
    
    // Position property for synchronization
    positionProp = StorageProperty.manualVec3("position", vec3.zero());
    
    // Session controller reference
    sessionController: SessionController = SessionController.getInstance();

    // Initialize the component
    initialize() {
        // Get the transform if not directly using this object
        this.transform = this.handObject ? 
            this.handObject.getTransform() : 
            this.getTransform();
            
        // Create sync entity
        this.syncEntity = new SyncEntity(this);
        
        // Register position property
        this.syncEntity.addStorageProperty(this.positionProp);
        
        // If this is the local hand, claim ownership
        if (this.isLocalHand) {
            this.syncEntity.tryClaimOwnership(() => {
                print("Successfully claimed ownership of local hand object");
            });
        }
        
        print(`Hand object sync initialized for ${this.isLocalHand ? "local" : "remote"} hand`);
    }
    
    // Update position data - send local position to network
    onUpdate() {
        // Only process if sync is ready
        if (!this.syncEntity || !this.syncEntity.isSetupFinished) return;
        
        // If this is our local hand, update the network with our position
        if (this.isLocalHand && this.syncEntity.doIOwnStore()) {
            const currentPos = this.transform.getWorldPosition();
            
            // Only update if position changed significantly (optimization)
            const currentNetPos = this.positionProp.currentOrPendingValue;
            if (currentPos.distance(currentNetPos) > 0.001) {
                this.positionProp.setPendingValue(currentPos);
            }
        }
        // If this is a remote hand, update the object with network position
        else if (!this.isLocalHand && !this.syncEntity.doIOwnStore()) {
            const networkPosition = this.positionProp.currentOrPendingValue;
            this.transform.setWorldPosition(networkPosition);
        }
    }
    
    onStart() {
        // Wait for session to be ready before initializing
        this.sessionController.notifyOnReady(() => this.initialize());
        
        // Register update callback
        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
    }
    
    onAwake() {
        // Set up start event
        this.createEvent("OnStartEvent").bind(() => this.onStart());
    }
}