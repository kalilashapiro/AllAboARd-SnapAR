"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartMenu = void 0;
var __selfType = requireType("./StartMenu");
function component(target) { target.getTypeName = function () { return __selfType; }; }
const SessionController_1 = require("../Core/SessionController");
const WorldCameraFinderProvider_1 = require("../SpectaclesInteractionKit/Providers/CameraProvider/WorldCameraFinderProvider");
const SyncKitLogger_1 = require("./SyncKitLogger");
// --- Type Declarations for Lens Studio Globals ---
// Removed declarations - caused conflicts
// declare const global: any;
// declare const input: Input;
// declare const KeyCode: any;
// declare class Input {
//     getKeyDown(keyCode: number): boolean;
// }
// declare const vec3: any;
// declare const quat: any;
// --- End Type Declarations ---
const TAG = "StartMenu";
let StartMenu = class StartMenu extends BaseScriptComponent {
    onStart() {
        // Re-enable the start menu if the connection fails
        SessionController_1.SessionController.getInstance().onConnectionFailed.add(() => {
            this.getSceneObject().enabled = true;
            this.setStartMenuInFrontOfUser();
        });
        // Skip the start menu if the lens was launched directly as multiplayer
        this.checkIfStartedAsMultiplayer();
        this.setStartMenuInFrontOfUser();
        this.singlePlayerButton.onButtonPinched.add(() => this.onSinglePlayerPress());
        this.multiPlayerButton.onButtonPinched.add(() => this.onMultiPlayerPress());
    }
    /**
     * If the systemUI has requested that the lens launch directly into multiplayer mode,
     * immediately dismiss this menu and initialize the Spectacles Sync Kit.
     */
    checkIfStartedAsMultiplayer() {
        const shouldStartMultiplayer = global.launchParams.getBool("StartMultiplayer");
        this.log.i(`Lens started as multiplayer: ${shouldStartMultiplayer}`);
        if (shouldStartMultiplayer) {
            this.onMultiPlayerPress();
        }
    }
    /**
     * Start the game in single player mode by hiding this menu.
     */
    onSinglePlayerPress() {
        // // Prevent timer or double-clicks from triggering again // Removed
        // if (this.gameHasStarted) return;
        // this.gameHasStarted = true;
        this.log.i("Single Player button pressed"); // Reverted log message
        switch (this.singlePlayerType) {
            case "manual":
            default:
                this.enableOnSingleplayerNodes.forEach((node) => {
                    node.enabled = true;
                });
                this.getSceneObject().enabled = false;
                break;
            case "mocked_online":
                SessionController_1.SessionController.getInstance().prepareOfflineMode();
                this.enableOnSingleplayerNodes.forEach((node) => {
                    node.enabled = true;
                });
                this.onMultiPlayerPress();
                break;
        }
    }
    /**
     * Handles the multi-player button press or direct multiplayer start.
     */
    onMultiPlayerPress() {
        // // Prevent timer or double-clicks from triggering again // Removed
        // if (this.gameHasStarted) return;
        // this.gameHasStarted = true;
        this.log.i("Multi Player button pressed or direct launch");
        this.log.i("Starting multiplayer flow");
        this.getSceneObject().enabled = false;
        SessionController_1.SessionController.getInstance().init();
        this.triggerFinalizeTrackScript();
    }
    // Helper function to safely call the finalize script
    triggerFinalizeTrackScript() {
        if (this.finalizeTrackScript) {
            this.finalizeTrackScript.initializeGame();
        }
        else {
            this.log.w("FinalizeTrackScript input is not set in the Inspector!");
        }
    }
    setStartMenuInFrontOfUser() {
        const head = this.worldCamera.getTransform().getWorldPosition();
        const forward = this.worldCamera.getTransform().forward;
        forward.y = 0;
        const pos = forward
            .normalize()
            .uniformScale(-this.startMenuDistanceFromUser);
        this.startMenuTransform.setWorldPosition(head.add(pos));
    }
    onUpdate() {
        if (!this.sceneObject.enabled) {
            return; // Don't update rotation if the menu is hidden
        }
        // --- Auto-Start Timer Logic --- // Removed
        /*
        if (!this.gameHasStarted) {
            this.timeElapsed += getDeltaTime();
            print(`Time Elapsed: ${this.timeElapsed}`); // Optional: uncomment for debugging
            if (this.timeElapsed >= this.AUTO_START_DELAY_SECONDS) {
                this.log.i(`Auto-start timer reached (${this.AUTO_START_DELAY_SECONDS}s). Starting Single Player.`);
                this.onSinglePlayerPress();
                // Note: onSinglePlayerPress will set gameHasStarted to true
                // and disable the menu, stopping further updates here.
                return; // Exit update early as game has started
            }
        }
        */
        // --- End Timer Logic ---
        // Calculate the direction the menu should face (towards the camera)
        const cameraPos = this.worldCamera.getTransform().getWorldPosition();
        const menuPos = this.startMenuTransform.getWorldPosition();
        // Ensure the menu doesn't rotate if camera and menu are at the same spot
        if (cameraPos.distance(menuPos) < 0.01) {
            return;
        }
        // Calculate the direction the menu should face (towards the camera)
        const lookDirection = cameraPos.sub(menuPos).normalize();
        // Calculate the rotation needed to look in that direction, keeping 'up' aligned with world up
        const lookRotation = quat.lookAt(lookDirection, vec3.up());
        // Apply the rotation
        this.startMenuTransform.setWorldRotation(lookRotation);
    }
    __initialize() {
        super.__initialize();
        this.log = new SyncKitLogger_1.SyncKitLogger(TAG);
        this.worldCamera = WorldCameraFinderProvider_1.default.getInstance();
        this.startMenuTransform = this.sceneObject.getTransform();
        this.createEvent("OnStartEvent").bind(() => this.onStart());
        this.createEvent("UpdateEvent").bind(() => this.onUpdate());
    }
};
exports.StartMenu = StartMenu;
exports.StartMenu = StartMenu = __decorate([
    component
], StartMenu);
//# sourceMappingURL=StartMenu.js.map