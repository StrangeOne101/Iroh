# Iroh
A Node.js discord bot that is designed to help users in the ProjectKorra discord.

There are a few commands for ops built in, but nothing too fancy. Things like

- `!reload` - reloads the config and the regex expressions
- `!bar @user` - Prevents the bot from responding to that user. Can be used when people abuse the bot. 
- `!unbar @user` - Unbars the user.
- `!ping` - See the latency of the bot
- `!update [-d]` - Updates the bot from the github repo

The bot also has a `/core/modules` and `/core/commands` folder that are loaded dynamically. They allow for easy additions for the bot.

# Installation
This bot is built on Node.js, so you must have that installed along with npm.

1. `npm install`
2. `npm install discord.js`

You can then run the bot with `node bot.js`

# Configuration

## Main configuration

The main config file can be found at `/config/config.json`. It stores things such as blocked users, the command prefix, ignored channels, as well as 'roles' that are used in code.

The token for the bot should be placed in `/config/token.txt`

The bot has an optional MOTD on startup. This can be found in `/config/motd.txt`. Because being fancy is great!

## Regex Responses

Regex responses are in JSON. They are composed of three components.

**Triggers**. What triggers the response. This is optional, and ones without triggers can be directed to through other responses via buttons. The trigger should be in regex format.

**Response**. What it should respond with. You can also use `responses` and provide an array of json objects. These objects will allow you to test the capture groups of the regex before replying with the corresponding response.

**Buttons**. These are buttons added to the response. If a URL is provided, it will direct users to that URL. But you can also direct users to another regex response file. This allows you to create chains of prompts for users to go through.

### First Example
Features a response to a naturally worded question, as well as a manuall command trigger. It has a button leading to a URL as well as a button that leads to talking about a specific server host's limitations.
```json
{
    "triggers": [
        "^\\.addons",
        "(((how|where).+(can i|do (you|i)).+(put|get|install|down ?load).+(addons|(custom|new).+abilit(y|ies))))"
    ],
    "response": "You can download addon abilties from the forums and then put them in your `/plugins/ProjectKorra/Abilities` directory. Click the button bellow for a link.\n\nSide plugins ALWAYS go into the `/plugins/` folder, and ability packs _generally_ go into the plugins folder. So read the installation guide on the resource page before installing. This includes things like JedCore, ProjectAddons, Hyperion, Spirits, BendingGUI, etc.",
    "buttons": [
        "Custom Abilities Category",
        "https://projectkorra.com/forum/resources/categories/custom-abilities.3/",
        "I'm on Aternos",
        "aternos.json"
    ]
}
```
### Second Example
When someone asks if ProjectKorra is compatible with X version, this responds according to what version they ask about.
```json
{
    "triggers": [
        "(?:does|is|can someone tell).+(?:pk|projectkorra|(?:this|the) plug(?: |-)?in).+(?:work|run|available|compatible).+(?:on|with|for).+(1\\.\\d{0,2}(?:\\.\\d)?(?:[?!.]{1,5}|$)"
    ],
    "responses": [
        {
            "condition": {
                "variable": "$1",
                "type": "equals",
                "values": [
                    "1.16",
                    "1.17",
                    "1.18",
                    "1.19"
                ]
            },
            "content": "Yes, ProjectKorra is compatible with Spigot/MC $1! The latest version works on 1.16 all the way through to 1.19.3!"
        },
        {
            "condition": {
                "variable": "$1",
                "type": "notequals",
                "values": [
                    "1.16",
                    "1.17",
                    "1.18",
                    "1.19",
                ]
            },
            "content": "The latest version of ProjectKorra only works between Spigot/MC 1.16 to 1.19.3. If you want to use an older version of Minecraft, you'll need to use an older version of PK.\n\nCheck the pins in support to see the versions compatible with what you want."
        }
    ]
}
```
