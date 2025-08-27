const API = require("../api");
const { promisify } = require('util');
const FS = require("fs");
const { ThreadChannel, ForumChannel, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const config = require("../config");
const PATH = require("path");
const { client } = require("../../bot");

let regexMap = new Map();
let fileMap = new Map();

const FUNC_CONTAINS = (s1, s2) => s1.contains(s2);
const FUNC_LESS_THAN = (s1, s2) => s1 < s2;
const FUNC_GREATER_THAN = (s1, s2) => s1 > s2;
const FUNC_LESS_THAN_EQUAL_TO = (s1, s2) => s1 <= s2;
const FUNC_GREATER_THAN_EQUALS_TO = (s1, s2) => s1 >= s2;
const FUNC_EQUALS = (s1, s2) => s1 == s2;
const FUNC_STARTS_WITH = (s1, s2) => s1.startsWith(s2);
const FUNC_ENDS_WITH = (s1, s2) => s1.endsWith(s2);

const CMD_REGEX = /^\.[a-zA-Z0-9-_]{3,}/i;

class ButtonResponse {

    static collectMap = new Map();

    constructor(message) {
        this.message = message;
        this.buttons = [];
        this.collectors = [];
        
        if (ButtonResponse.collectMap.has(message.id)) {
            let old = ButtonResponse.collectMap.get(message.id);
            if (old.timeoutId != -1) 
                clearTimeout(old.timeoutId); //Remove the timeout ask of the old one
            
            for (let coll of old.collectors) {
                coll.stop(); //Remove the old collectors
            }
        }

        ButtonResponse.collectMap.set(message.id, this);

        //Make a timeout task to remove this from memory
        this.timeoutId = setTimeout(() => ButtonResponse.collectMap.delete(message.id), 1_800_000);
    }

    /**
     * Creates a button and registers a handler to run the callback when it is clicked.
     * This method does NOT add the button to the message. 
     * @param {*} text The label of the button
     * @param {*} link The thing the button should direct to. Only works for URLs
     * @param {*} callback The callback to run
     * @returns The created button
     */
    addButton(text, link, callback = undefined) {
        let intid = this.buttons.length + 1; //+1 because 0 is reserved for "Back"
        let id = this.message.id + "_" + String(intid);

        if (this.message.editedTimestamp !== undefined && this.message.editedTimestamp !== null) {
            id = this.message.id + "_" + String(this.message.editedTimestamp) + String(intid)
        }

        let button = new ButtonBuilder();
        let isLink = link.startsWith("https://") || link.startsWith("http://") || link.startsWith("www.");
        button.setLabel(text);
        if (isLink) {
            button.setURL(link);
            button.setStyle(ButtonStyle.Link);
        } else {
            button.setStyle(ButtonStyle.Secondary);
            button.setCustomId(id);
        }

        if (callback !== undefined && !isLink) {
            let collector = this.message.channel.createMessageComponentCollector(
                {
                    //If the person clicking is either staff or the user who asked
                    filter: interaction => (interaction.user.id == this.message.author.id || API.hasRole(interaction.member, "staff") || //If it was the author or staff
                    (this.message.repliedTo !== undefined && interaction.user.id == this.message.repliedTo.author.id) || //OR let the intended person respond to it
                    (this.message.mentions !== undefined && this.message.mentions.has(interaction.user.id))) && //OR if the user is mentioned
                        interaction.customId == id, 
                    time: 1_800_000
                });
            collector.on("collect", interaction => callback(interaction));
            this.collectors.push(collector);
        }
        
        this.buttons.push(button);
        
        return button;
    }
}

class Response {

    constructor(jsonObject) {
        if (typeof jsonObject === 'string' || jsonObject instanceof String) {
            this.text = jsonObject;
            this.conditions = [];
        } else {
            this.basic = false;
            this.text = jsonObject.content;
            this.conditions = [];

            //Add all conditions. If there is only a single one, just use a single entry array for the loop
            for (let c of jsonObject.conditions || [jsonObject.condition]) {
                this.conditions.push(new Condition(c));
            }
        }
    }

    /**
     * Try to respond to a message, given the conditions for replying
     * @param {*} message The message to reply to
     * @param {*} matches The regex capture groups matched
     * @returns A Pair<Boolean, ?Promise<TextMessage>>. The boolean will be true if there is a promise
     */
    respond(message, matches = []) {
        //Function to replace all the variables
        let replFunc = () => {
            let clone = this.text.slice();
            for (let m in matches) {
                clone = clone.replaceAll("$" + m, matches[m]);
            }
            clone = clone.replaceAll("$mention", "<@" + message.id + ">")
                        .replaceAll("$channel", "<#" + message.channel.id + ">")
                        .replaceAll("$user", message.member.nickname | message.author.username);
            return clone;
        }

        //Check all conditions
        for (let con of this.conditions) {
            if (!con.test(message, matches))  //If one of the conditions fail, don't reply
                return undefined;
        }

        //All conditions passed. So pass what the reply should be
        return replFunc();
    }
}

class Condition {

    constructor(object) {
        this.variable = object.variable.toLowerCase();
        this.type = object.type.toLowerCase().replaceAll("[-_ ]", "").replaceAll("or", "").replaceAll("to", "");
        this.invert = false;
        if (object.type.toLowerCase().startsWith("not")) {
            this.invert = true;
            this.type = object.type.substr(3);
        } else if (object.type.startsWith("!")) {
            this.invert = true;
            this.type = object.type.substr(1);
        }
        
        this.values = object.values || [object.value];


        switch (this.type) {
            case "=":
            case "==":
            case "equals": this.func = FUNC_EQUALS; break;
            case "contains": this.func = FUNC_CONTAINS; break;
            case "startswith": this.func = FUNC_STARTS_WITH; break;
            case "endswith": this.func = FUNC_ENDS_WITH; break;
            case ">":
            case "greater":
            case "greaterthan": this.func = FUNC_GREATER_THAN; break;
            case "<":
            case "less":
            case "lessthan": this.func = FUNC_LESS_THAN; break;
            case ">=":
            case "greaterequal":
            case "greaterequals":
            case "greaterthanequal":
            case "greaterthanequals": this.func = FUNC_GREATER_THAN_EQUALS_TO; break;
            case "<=":
            case "lessequal":
            case "lessequals":
            case "lessthanequal":
            case "lessthanequals": this.func = FUNC_LESS_THAN_EQUAL_TO; break;
        }
    }

    /**
     * Tests the condition
     * @param {*} message The message used to test
     * @param {*} matches The matches gotten from the regex expression
     * @returns True if the condition passed
     */
    test(message, matches = ["?"]) {
        let realVar = undefined;

        if (this.variable == "name" || this.variable == "username") realVar = message.author.username;
        else if (this.variable == "user") realVar == message.author.tag;
        else if (this.variable == "userid") realVar = message.author.id;
        else if (/\$\d{1,2}/g.test(this.variable)) realVar = matches[parseInt(this.variable.substr(1))];
        else {
            console.warn("Failed to parse variable " + this.variable + " in json file " + this.file + "!");
            return false;
        }

        for (let val of this.values) {
            if (!this.invert && realVar == val) return true;
            else if (this.invert && realVar != val) return true;
        }
        return false;
    }
}

class CollectiveResponse {

    constructor(jsonObject, file) {
        this.triggers = jsonObject.triggers || [jsonObject.trigger] || [];
        this.responses = [];
        this.buttons = jsonObject.buttons || [];
        this.file = file;

        for (let resp of jsonObject.responses || [jsonObject.response]) {
            this.responses.push(new Response(resp));
        }
    }

    __make(message, text, previous = undefined) {
        let buttonResponse = new ButtonResponse(message);
        let actualButtons = [];

        if (previous !== undefined && previous !== '') {
            let next = previous.split(";")[0];

            let otherCollective = fileMap.get(next);
            if (otherCollective === undefined) {
                console.warn("Could not find correct redirect when going back: '" + previous + "'");
            } else {
                let cut = previous.substring(next.length + 1, previous.length + 1); //We have to use this dumb way as JS split doesn't work like Java's split does

                let interactive = (i) => otherCollective.edit(message, i, cut);
                actualButtons.push(buttonResponse.addButton("(Back)", next, interactive));
            }
        }

        for (let i = 0; i < this.buttons.length / 2; i++) {
            let label = this.buttons[i * 2];
            let redirect = this.buttons[i * 2 + 1];
            let isUrl = redirect.startsWith("https://") || redirect.startsWith("http://") || redirect.startsWith("www.");
            let isJson = redirect.toLowerCase().endsWith(".json");

            if (isUrl) {
                actualButtons.push(buttonResponse.addButton(label, redirect));
            } else if (isJson) {
                //Make sure they get the correct directory without any bs like different types of slashes
                redirect = redirect.replaceAll(/\\/g, "/");
                if (!redirect.startsWith("/")) redirect = "/" + redirect;

                let otherCollective = fileMap.get(redirect);
                if (otherCollective === undefined) {
                    console.warn("Could not find redirect json file in file " + this.file + ": '" + redirect + "'");
                    continue;
                }

                let newPrev = this.file;
                if (previous !== undefined) newPrev = this.file + ";" + previous;

                let interactive = (i) => otherCollective.edit(message, i, newPrev);
                actualButtons.push(buttonResponse.addButton(label, redirect, interactive));
            } else {
                console.warn("Invalid redirection for " + this.file + ": " + redirect);
            }
        }

        let components = [];
        if (actualButtons.length > 0) {
            //Because each ActionRow can only have 5 buttons max
            for (let i = 0; i < (parseInt((actualButtons.length - 1) / 5)) + 1; i++) { //ParseInt rounds the number to the nearest int
                let builder = new ActionRowBuilder();
                const bumper = i * 5;

                for (let j = 0; j < (actualButtons.length - bumper) && j < 5; j++) { //Make sure to only iterate 5 buttons 
                    let button = actualButtons[bumper + j];
                    builder.addComponents(button);
                }
                components.push(builder);
            }
            
        }
        return {content: text, components: components}
    }

    async reply(message, matches) {
        let command = CMD_REGEX.test(matches[0]); //Boolean, whether it is a dot command or not

        for (let res of this.responses) {
            let text = res.respond(message, matches);
            if (text !== undefined) {
                if (command && message.reference !== null && message.reference.messageId !== null) { //If its a dot command & they replied to a message
                    message.repliedTo = await message.channel.messages.fetch(message.reference.messageId); //Find what message they replied to, if they did.
                    //And then store it in the message obj so other methods can access it
                }
                let contents = this.__make(message, text);
                
                if (message.repliedTo !== undefined) {
                    await message.repliedTo.reply(contents); //Reply to the intended user
                } else {
                    await message.reply(contents); //Reply to default user
                }
                
                break;
            }
        }
    }

    async edit(message, interaction, previous = undefined) {
        for (let res of this.responses) {
            let text = res.respond(message, []);
            if (text !== undefined) {
                let contents = this.__make(message, text, previous);
                await interaction.update(contents);
                break
            }
        }
    }
}

async function getFiles(dir) {
    const readdir = promisify(FS.readdir);
    const stat = promisify(FS.stat);
    const subdirs = await readdir(dir);
    const files = await Promise.all(subdirs.map(async (subdir) => {
      const res = PATH.resolve(dir, subdir);
      return (await stat(res)).isDirectory() ? getFiles(res) : res;
    }));
    return files.reduce((a, f) => a.concat(f), []);
  }

/**
 * Loads responses from config
 */
async function loadResponses() {
    let dir = PATH.join(__dirname, "../../config/autoresponses");

    regexMap.clear(); //Reset the maps!
    fileMap.clear();


        const files = await getFiles(dir);
        files.forEach(file => { 

            try {
                let path = file.substr(dir.length);
                let json = JSON.parse(FS.readFileSync(file, 'utf8'));

                if (Array.isArray(json)) {
                    for (let o of json) {
                        addResponse(o, path);
                    }
                } else {
                    addResponse(json, path);
                }
            } catch(err) {
		        console.warn(`Unable to scan autoresponses file ${file}: ` + err);
            }
        } );

        console.log("Loaded " + regexMap.size + " regex replies(s).");
    

}

function addResponse(object, file) {
    file = file.replaceAll(/\\/g, "/");
    let collectiveResponse = new CollectiveResponse(object, file);
    fileMap.set(file, collectiveResponse);

    let trigs = 0;
    for (let trigger of object.triggers || [object.trigger] || []) {
        if (trigger != '' && trigger !== undefined) {
            try {
                let reg = new RegExp(trigger, "i");
                regexMap.set(reg, collectiveResponse);
                trigs++;
            } catch (e) {
                console.warn("Invalid regex in " + file + ": " + trigger);
            }
        }
    }
    if (trigs > 0) {
        console.log("Added " + trigs + " regex triggers for file " + file);
    }
}

async function onTextMessage(message) {
    let channel = message.channel;
    let msg = API.stripFormatting(message.content);

    if (config.getIgnoredChannels().indexOf(channel.id) != -1 || config.getIgnoredChannels().indexOf(channel.name) != -1) {
        return;
    } else if (message.author.id == client.user.id) return; //Skip if its the bot talking

    //Loop through all triggers we have load
    for (trigger of regexMap.keys()) {
        if (trigger.test(msg)) {
            message.client.lastUsedChannel = channel;
            let collectiveResponse = regexMap.get(trigger);
            collectiveResponse.reply(message, msg.match(trigger)).catch(e => {
                console.error(`Error auto-responding to message ${message.id}`, e);
                message.reply("An error occured. Please check the console");
            }); //Reply with the collective response
            return;
        }
    }
}

API.subscribe("reload", loadResponses); //Register the reload of reactions on reload
API.subscribe("messageCreate", onTextMessage); //Register the handler for when text messages are sent

loadResponses(); //Load the reactions