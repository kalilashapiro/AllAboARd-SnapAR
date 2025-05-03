import { HandController_TS } from "./HandController_TS";
import { Interactable } from "SpectaclesSyncKit/SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable";
import { InteractableManipulation } from "SpectaclesSyncKit/SpectaclesInteractionKit/Components/Interaction/InteractableManipulation/InteractableManipulation";
import { PinchButton } from "SpectaclesSyncKit/SpectaclesInteractionKit/Components/UI/PinchButton/PinchButton";
import { SessionController } from "SpectaclesSyncKit/Core/SessionController";
import { StorageProperty } from "SpectaclesSyncKit/Core/StorageProperty";
import { SyncEntity } from "SpectaclesSyncKit/Core/SyncEntity";

@component
export class SceneController_TS extends BaseScriptComponent {

  @input()
  leftPaddle: HandController_TS;

  @input()
  leftPaddleInteractable: Interactable;


  @input()
  rightPaddle: HandController_TS;

  @input()
  rightPaddleInteractable: Interactable;


  @input()
  startGameButton: PinchButton;

  isLeftPlayer: boolean = false;
  isRightPlayer: boolean = false;
  hasInitAsOwner: boolean = false;
  syncEntity: SyncEntity;
  sessionController: SessionController = SessionController.getInstance();

  private isGameStartedProp = StorageProperty.manualBool(
    "isGameStarted",
    false
  );


  initAsClient() {
    this.refreshUI();
  }

  initAsOwner() {
    if (this.hasInitAsOwner) return;

    this.hasInitAsOwner = true;


    this.startGameButton.onButtonPinched.add(() => this.startGame());


    this.refreshUI();
  }

  isHost() {
    return this.syncEntity.isSetupFinished && this.syncEntity.doIOwnStore();
  }

  joinLeft() {
    if (
      !this.isLeftPlayer &&
      !this.isRightPlayer &&
      !this.leftPaddle.syncEntity.isStoreOwned()
    ) {
      this.setupForLeftSide();
    }
  }

  joinRight() {
    if (
      !this.isLeftPlayer &&
      !this.isRightPlayer &&
      !this.rightPaddle.syncEntity.isStoreOwned()
    ) {
      this.setupForRightSide();
    }
  }

  refreshUI() {
    const isConnected: boolean = this.syncEntity.isSetupFinished;
  }


  setupForLeftSide() {
    this.leftPaddle.syncEntity.tryClaimOwnership(() => {
      this.isLeftPlayer = true;
      this.refreshUI();
    });
  }

  setupForRightSide() {
    this.rightPaddle.syncEntity.tryClaimOwnership(() => {
      this.isRightPlayer = true;
      this.refreshUI();
    });
  }

  startGame() {
    print("Start button pinched");
    if (!this.isGameStartedProp.currentOrPendingValue) {
      this.isGameStartedProp.setValueImmediate(
        this.syncEntity.currentStore,
        true
      );
      this.refreshUI();
      print("Start game");
    }
  }





  onSyncEntityReady() {
    print("Sync entity ready");

    if (this.isHost()) {
      this.initAsOwner();
    } else {
      this.initAsClient();
    }

    this.leftPaddleInteractable.onHoverEnter.add(() => this.joinLeft());
    this.rightPaddleInteractable.onHoverEnter.add(() => this.joinRight());

    this.leftPaddle.syncEntity.onOwnerUpdated.add(() => {
      print("Left paddle owner updated");
      this.refreshUI();
    });
    this.rightPaddle.syncEntity.onOwnerUpdated.add(() => {
      print("Right paddle owner updated");
      this.refreshUI();
    });


    this.refreshUI();
  }

  onOwnershipUpdated() {
    if (!this.syncEntity.isStoreOwned()) {
      print("Controller is not owned, trying to claim");
      this.syncEntity.tryClaimOwnership(() => this.initAsOwner());
    }
    this.refreshUI();
  }

  onSessionReady() {
    print("Session ready");


    this.syncEntity = new SyncEntity(this, null, true);
    this.syncEntity.addStorageProperty(this.isGameStartedProp);



    this.syncEntity.notifyOnReady(() => this.onSyncEntityReady());
    this.syncEntity.onOwnerUpdated.add(() => this.onOwnershipUpdated());
  }

  onStart() {
    this.sessionController.notifyOnReady(() => this.onSessionReady());
  }

  onAwake() {

    this.createEvent("OnStartEvent").bind(() => this.onStart());
  }
}
