import { HandObjectSync } from "./HandObjectSync";
import { Line } from "./SpectaclesSyncKit/Line";
import { SessionController } from "./SpectaclesSyncKit/Core/SessionController";

@component
export class ConnectionController extends BaseScriptComponent {
    // Reference to player 1's hand object sync
    @input()
    player1HandSync: HandObjectSync;
    
    // Reference to player 2's hand object sync
    @input()
    player2HandSync: HandObjectSync;
    
    // Reference to line component
    @input()
    connectionLine: Line;
    

    @input()
    startPoint: SceneObject;

 
    @input()
    endPoint: SceneObject;
    
    // Session controller reference
    sessionController: SessionController = SessionController.getInstance();
    
    // Initialize the line connection
    initialize() {
        print("Initializing hand line controller");
        
        // Create dummy objects to use as line endpoints if needed
        if (!this.connectionLine.startPointObject) {
            this.connectionLine.startPointObject = this.startPoint;
        } else {
            this.startPoint = this.connectionLine.startPointObject;
        }
        
        if (!this.connectionLine.endPointObject) {          
            this.connectionLine.endPointObject = this.endPoint;
        } else {
            this.endPoint = this.connectionLine.endPointObject;
        }
    }
    
    // Update line endpoints based on hand positions
    onUpdate() {
        // Skip if not initialized
        if (!this.player1HandSync || !this.player2HandSync) return;
        
        // Get hand positions
        const player1Pos = this.player1HandSync.isLocalHand ? 
            this.player1HandSync.transform.getWorldPosition() : 
            this.player1HandSync.positionProp.currentOrPendingValue;
            
        const player2Pos = this.player2HandSync.isLocalHand ? 
            this.player2HandSync.transform.getWorldPosition() : 
            this.player2HandSync.positionProp.currentOrPendingValue;
        
        // Update line endpoint positions
        this.startPoint.getTransform().setWorldPosition(player1Pos);
        this.endPoint.getTransform().setWorldPosition(player2Pos);
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