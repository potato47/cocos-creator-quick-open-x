'use strict';

let isOpen = false;

module.exports = {

  load() {
    // execute when package loaded
  },

  unload() {
    // execute when package unloaded
  },

  // register your ipc messages here
  messages: {
    'open'() {
      if (!isOpen) {
      }
      Editor.Panel.open('quick-open-x');
    },
    'search-scene-prefab'() {
      if (!isOpen) {
        Editor.Panel.open('quick-open-x');
      } else {
        Editor.Ipc.sendToPanel('quick-open-x', 'quick-open-x:search', true);
      }
    },
    'search-all'() {
      if (!isOpen) {
        Editor.Panel.open('quick-open-x');
      } else {
        Editor.Ipc.sendToPanel('quick-open-x', 'quick-open-x:search', false);
      }
    },
    'panel-ready'() {
      isOpen = true;
    },
    'panel-close'() {
      isOpen = false;
    },
  },
};
