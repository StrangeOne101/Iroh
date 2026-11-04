const configJS = require('../config.js');
const bot = require('../../bot.js');
function chooseQuote(){
    const quotes = configJS.getQuotes();
    const people = Object.keys(quotes);
    const randomPerson = people[Math.floor(Math.random() * people.length)];
    const quotesList = quotes[randomPerson];
    const randomQuote = quotesList[Math.floor(Math.random()*quotesList.length)] + "  -" + randomPerson.charAt(0).toUpperCase() + randomPerson.slice(1);
    return randomQuote;
}
function setQuote(){//set custom bot status
    const quote = chooseQuote();
    console.log("qoute is " + quote);
    bot.client.user.setActivity(quote, {type: 4});
}
setQuote();
const changeDelay = 24 * 60 * 60 * 1000;
setInterval(setQuote, changeDelay);