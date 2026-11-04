const fs = require("fs");

var config = {};

const file = "./config/config.json";
const tokenFile = "./config/token.txt";
const openaiTokenFile = './config/openai_token.txt'
const quotesFile = "./config/quotes.json"

//Get document, or throw exception on error


function load() {
	try {
		console.log("Loading config...");
		config = JSON.parse(fs.readFileSync(file, 'utf8'));
		console.log("JSON Config loaded!");
		if (!fs.existsSync(tokenFile)) {
			console.log(`No token file found! Please insert your token into ${tokenFile}!`);
			fs.appendFileSync(tokenFile, "Please insert your token here!", "utf8");
			return false;
		}
		let token = fs.readFileSync(tokenFile, 'utf8');
		if (token.indexOf(" ") > -1 || token == "" || token.length < 10) {
			console.log(`You haven't provided your token! Please insert it into ${tokenFile}!`);
			return false;
		}
		config.Token = token;

		// load openai api key for stack trace analyzer
		if (!fs.existsSync(openaiTokenFile)) {
			console.log(`No openai token file found! Please insert your api key into ${openaiTokenFile}!`);
			fs.appendFileSync(openaiTokenFile, "Please insert your api key here!", "utf8");
			return false;
		}
		let openaiToken = fs.readFileSync(openaiTokenFile, 'utf8');
		if (openaiToken.indexOf(" ") > -1 || token == "" || token.length < 10) {
			console.log(`You haven't provided your openai api key! Please insert it into ${openaiTokenFile}!`);
			return false;
		}
		let quotes = JSON.parse(fs.readFileSync(quotesFile, "utf8"));
		config.Quotes = quotes;
		config.OpenAIToken = openaiToken;
	} catch (e) {
		console.log(e);
		return false;
	}
	return true;
}

function save() {
	if (typeof config.BarredUsers === 'undefined') config.BarredUsers = [];
	if (typeof config.Ops === 'undefined') config.Ops = [];
	if (typeof config.CommandPrefix === 'undefined') config.CommandPrefix = "!";
	if (typeof config.UpdateURL === 'undefined') config.UpdateURL = "https://github.com/StrangeOne101/Iroh";
	try {
		fs.writeFileSync(file, JSON.stringify(config));
	} catch (e) {
		console.log(e);
		return false;
	}
	return true;
}

function isUserBarred(id) {
	return config.BarredUsers.indexOf(id) != -1;
}

function barUser(id) {
	if (isUserBarred(id)) return false;
	config.BarredUsers.push(id);
	save();
	return true;
}

function unbarUser(id) {
	if (!isUserBarred(id)) return false;
	
	config.BarredUsers = config.BarredUsers.filter((item)=>item != id);
	save();
	return true;
}

function isOp(id) {
	return config.Ops.includes(id);
}

function getToken() {
	return typeof config.Token === 'undefined' ? "" : config.Token;
}

function getOpenAIToken() {
	return typeof config.OpenAIToken === 'undefined' ? "" : config.OpenAIToken;
}

function getSplit() {
	return typeof config.Split === 'undefined' ? ">>" : config.Split;
}

function getCommandPrefix() {
	return typeof config.CommandPrefix === 'undefined' ? "!" : config.CommandPrefix;
}

function getIgnoredChannels() {
	return typeof config.IgnoredChannels === 'undefined' ? [] : config.IgnoredChannels;
}

function getRoles(group) {
	return config.Roles && Array.isArray(config.Roles[group]) ? config.Roles[group] : [];
}

function getUpdateURL() {
	return config.UpdateURL;
}

function getQuotes() {
	return config.Quotes;
}

function getPunishmentChannel(){
	return config.PunishmentChannel;
}
//ES6
module.exports = {
	getToken,
	getOpenAIToken,
	getRoles,
	getSplit,
	getIgnoredChannels,
	getCommandPrefix,
	getUpdateURL,
	isOp,
	unbarUser,
	isUserBarred,
	barUser,
	load,
	save,
	getQuotes,
	getPunishmentChannel,
	getOps: () => config.Ops,
	getBarredUsers: () => config.BarredUsers
	
}
