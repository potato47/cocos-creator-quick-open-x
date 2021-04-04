const { ipcRenderer } = require('electron');
const { registerAutocomplete } = require('./components/autocomplete');

const App = {
  data() {
    return {
      items: [],
      commands: [],
    }
  },
  mounted() {
    ipcRenderer.on('active-search', (event, items, commands) => {
      this.$refs.search.focus();
      this.$refs.search.clear();
      this.items = items;
      this.commands = commands;
      console.log(commands);
    });
  },
  methods: {
    onEsc() {
      ipcRenderer.send('search-cancel');
    },
    onEnter(result) {
      ipcRenderer.send('search-confirm', result);
    },
  },
};
const app = Vue.createApp(App);
registerAutocomplete(app);
app.mount('#app');
