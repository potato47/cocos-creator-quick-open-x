const fs = require("fs");
const path = require("path");

const MAX_RESULTS_COUNT = 50;
const PER_PAGE_COUNT = 10;
const ITEM_HEIGHT = 34;
const REG_KEYS = ["\\", "^", "$", "*", "+", "?", ".", "|", "(", ")"];

function registerAutocomplete(app) {
  const templateContent = fs.readFileSync(
    path.join(__dirname, "autocomplete.html"),
    "utf-8"
  );
  const styleContent = fs.readFileSync(
    path.join(__dirname, "autocomplete.css"),
    "utf-8"
  );
  loadCss(styleContent);
  app.component("autocomplete", {
    template: templateContent,
    props: ["items", "commands"],
    emits: ["on-esc", "on-enter"],
    data() {
      return {
        searchText: "",
        searchKey: "",
        results: [],
        isOpen: false,
        arrowCounter: 0,
        selected: "",
        isCommand: false,
        onlyLocate: false,
      };
    },
    mounted() {
      this.focus();
    },
    watch: {
      searchText() {
        if (this.searchText !== "") {
          if (this.searchText.startsWith(">")) {
            this.isCommand = true;
            this.searchKey = this.searchText.substring(1);
          } else {
            this.isCommand = false;
            if (this.searchText.endsWith(":")) {
              this.searchKey = this.searchText.substring(
                0,
                this.searchText.length - 1
              );
              this.onlyLocate = true;
            } else {
              this.searchKey = this.searchText;
              this.onlyLocate = false;
            }
          }
          this.searchKey = this.searchKey.toLowerCase();
          this.filterResults();
          this.setOpen(true);
        } else {
          this.arrowCounter = 0;
          this.setOpen(false);
          this.results = [];
        }
      },
    },
    methods: {
      focus() {
        this.$refs.search.focus();
      },
      clear() {
        this.searchText = "";
      },
      setOpen(isOpen) {
        if (isOpen === this.isOpen) return;
        this.isOpen = isOpen;
        if (isOpen) {
          this.arrowCounter = 0;
          setTimeout(() => {
            this.updateScroll();
          }, 10);
        }
      },
      filterResults() {
        if (this.isCommand) {
          this.filterCommands();
        } else {
          this.filterItems();
        }
      },
      filterItems() {
        this.results = this.items
          .filter((item) => {
            const key = this.searchKey;
            const targetName = item.name.toLowerCase();
            const targetPath = item.path.toLowerCase();
            let index = targetName.indexOf(key);
            if (index > -1) {
              item.sort = index;
              item.matchName = true;
              return true;
            }
            index = targetPath.indexOf(key);
            if (index > -1) {
              item.sort = 30000000 + index;
              item.matchName = false;
              return true;
            }
            const keyChars = key.split("").map((c) => {
              if (REG_KEYS.includes(c)) {
                c = "\\" + c;
              }
              return c;
            });
            const keyReg = new RegExp(keyChars.join(".*"));
            if (keyReg.test(targetName)) {
              item.sort = 20000000;
              item.matchName = true;
              return true;
            }
            if (keyReg.test(targetPath)) {
              item.sort = 40000000;
              item.matchName = false;
              return true;
            }
            return false;
          })
          .sort((r1, r2) => {
            return r1.sort - r2.sort;
          })
          .slice(0, MAX_RESULTS_COUNT)
          .map(item => {
            const keyChars = this.searchKey.split("");
            const nameChars = item.name.split("");
            const pathChars = item.path.split("");
            const displayChars = [];
            let keyIndex = 0;
            let nameIndex = 0;
            let pathIndex = 0;
            while (nameIndex < nameChars.length) {
              if (
                item.matchName &&
                keyIndex < keyChars.length &&
                nameChars[nameIndex].toLowerCase() === keyChars[keyIndex]
              ) {
                displayChars.push(
                  `<span class='autocomplete-li-keyword'>${nameChars[nameIndex]}</span>`
                );
                keyIndex++;
              } else {
                displayChars.push(`${nameChars[nameIndex]}`);
              }
              nameIndex++;
            }
            displayChars.push(`&nbsp;`);
            keyIndex = 0;
            while (pathIndex < pathChars.length) {
              if (
                !item.matchName &&
                keyIndex < keyChars.length &&
                pathChars[pathIndex].toLowerCase() === keyChars[keyIndex]
              ) {
                displayChars.push(
                  `<span class='autocomplete-li-keyword autocomplete-li-path'>${pathChars[pathIndex]}</span>`
                );
                keyIndex++;
              } else {
                displayChars.push(
                  `<span class='autocomplete-li-path'>${pathChars[pathIndex]}</span>`
                );
              }
              pathIndex++;
            }
            item.display = displayChars.join("");
            return item;
          });
      },
      filterCommands() {
        this.results = this.commands.map((command) => {
          if (command.name.endsWith(": ")) {
            command.display = `${command.name}${this.searchKey}`;
          } else {
            command.display = command.name;
          }
          return command;
        });
      },
      onClick(i) {
        this.arrowCounter = i;
        this.onEnter();
      },
      onArrowDown(event) {
        event.stopPropagation();
        event.preventDefault();
        if (this.arrowCounter < this.results.length - 1) {
          this.arrowCounter = this.arrowCounter + 1;
        } else {
          this.arrowCounter = 0;
          this.$refs.fileslist.scrollTop = 0;
        }
        this.updateScroll();
      },
      onArrowUp(event) {
        event.stopPropagation();
        event.preventDefault();
        if (this.arrowCounter > 0) {
          this.arrowCounter = this.arrowCounter - 1;
          this.updateScroll();
        }
      },
      onEnter(event) {
        let item = this.results[this.arrowCounter];
        if (this.isOpen && item) {
          item = JSON.parse(JSON.stringify(item));
          item.isCommand = this.isCommand;
          item.onlyLocate = this.onlyLocate;
          if (this.isCommand) {
            item.param = this.searchKey;
          }
          this.$emit("on-enter", item);
          this.searchText = "";
          this.arrowCounter = 0;
          this.setOpen(false);
          this.updateScroll();
        }
      },
      onEsc(event) {
        event.stopPropagation();
        event.preventDefault();
        this.$emit("on-esc");
        this.searchText = "";
      },
      updateScroll() {
        if (this.arrowCounter === 0) {
          this.$refs.fileslist.scrollTop = 0;
          return;
        }
        if (this.arrowCounter >= PER_PAGE_COUNT) {
          const offset =
            (this.arrowCounter - (PER_PAGE_COUNT - 1)) * ITEM_HEIGHT;
          this.$refs.fileslist.scrollTop = offset;
        }
      },
    },
  });
}

function loadCss(code) {
  const style = document.createElement("style");
  style.type = "text/css";
  style.rel = "stylesheet";
  style.appendChild(document.createTextNode(code));
  const head = document.getElementsByTagName("head")[0];
  head.appendChild(style);
}

module.exports = { registerAutocomplete };
