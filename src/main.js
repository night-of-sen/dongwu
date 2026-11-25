import './style.css';
import { StorageService } from './services/storageService.js';
import { AudioService } from './services/audioService.js';
import { AIService } from './services/aiService.js';
import { WorldManager } from './three/WorldManager.js';
import { UIManager } from './ui/UIManager.js';

const storage = new StorageService();
const audio = new AudioService();
const ai = new AIService(storage);

const container = document.getElementById('canvas-container');

let ui;
const world = new WorldManager(container, {
  onTransitionStart: (biome) => {
    audio.stopSpeaking();
    ui.showTransition(biome);
  },
  onLoadProgress: (biome, loaded, total) => {
    ui?.updateTransitionProgress(biome, loaded, total);
  },
  onTransitionEnd: () => {
    ui.hideTransition();
  },
  onBiomeClicked: (biomeId) => {
    enterBiome(biomeId);
  },
  onAnimalClicked: (animalId) => {
    openAnimal(animalId);
  },
  onPlanetLabelsUpdate: (labels) => {
    ui?.updatePlanetLabels(labels);
  },
  onAnimalBadgesUpdate: (badges) => {
    ui?.updateAnimalBadges(badges);
  },
});

ui = new UIManager({
  storage,
  audio,
  ai,
  handlers: {
    onEnterBiome: (biomeId) => enterBiome(biomeId),
    onReturnPlanet: () => returnPlanet(),
    onToggleDayNight: () => {
      const nextNight = !world.isNight;
      world.setNightMode(nextNight);
      audio.playSfx('pop');
      return nextNight;
    },
    onCloseAnimal: () => {
      audio.playSfx('pop');
      world.deselectAnimal();
      ui.closeAnimalCard();
    },
    onTopicTriggered: (animal, topicKey) => {
      if (topicKey === 'intro') {
        world.triggerSelectedAnimalAction('greet', null, 2.2);
        ui.updateMoodLabel('正在自我介绍');
      } else if (topicKey === 'food') {
        world.triggerSelectedAnimalAction('eat', 'food', 2.6);
        audio.playSfx('feed');
        ui.updateMoodLabel('聊起美食流口水');
      } else if (topicKey === 'trick') {
        world.triggerSelectedAnimalAction('trick', 'sparkle', 3.4);
        audio.playSfx('trick');
        ui.updateMoodLabel('表演拿手绝活！');
      } else if (topicKey === 'secret') {
        world.triggerSelectedAnimalAction('greet', 'sparkle', 2.2);
        audio.playSfx('star');
        ui.updateMoodLabel('分享悄悄话');
      }
    },
    onPetAnimal: (animal) => {
      storage.incrementPet(animal.id);
      audio.playSfx('pet');
      world.triggerSelectedAnimalAction('pet', 'heart', 2.2);
      ui.updateMoodLabel('被摸摸超开心 ❤️');
      ui.setSpeech(animal.petReaction, animal.voice, 'pet');
    },
    onFeedAnimal: (animal) => {
      audio.playSfx('feed');
      world.triggerSelectedAnimalAction('eat', 'food', 2.6);
      ui.updateMoodLabel('正在吃小零食 🍃');
      ui.setSpeech(animal.feedReaction, animal.voice, 'feed');
    },
    onTakePhoto: (animal) => {
      audio.playSfx('shutter');
      ui.triggerCameraFlash();
      const dataUrl = world.captureSnapshot();
      storage.saveAnimalPhoto(animal.id, dataUrl);
      ui.showToast(`📸 咔嚓！已把 ${animal.name} 的照片收藏进图鉴啦！`);
    },
    onAiReplied: () => {
      world.triggerSelectedAnimalAction('greet', 'sparkle', 2.0);
    },
  },
});

function enterBiome(biomeId) {
  audio.playSfx('enter');
  world.focusAndEnterBiome(biomeId, (biome) => {
    ui.setModeHabitat(biome);
  });
}

function returnPlanet() {
  audio.playSfx('back');
  world.returnToPlanet(() => {
    ui.setModePlanet();
  });
}

function openAnimal(animalId) {
  const actor = world.selectAnimal(animalId);
  if (!actor) return;

  const isNew = storage.markDiscovered(animalId);
  audio.playAnimalCue(animalId);
  if (isNew) {
    audio.playSfx('star');
    ui.showToast(`🌟 认识了新朋友：${actor.config.emoji} ${actor.config.name}（${actor.config.species}）！`);
  }
  ui.openAnimalCard(actor.config, actor.getReadableStatus());
}
