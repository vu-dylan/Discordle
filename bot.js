import dotenv from 'dotenv'
import Discord from "discord.js"
import express from 'express'
import cron from 'cron'
import { GetMessageIDs } from './util/discord.js';
import { formatGuess, generateHotWord, checkIfvalid, makeLetterObject } from './util/wordle.js'

dotenv.config();

const APP = express();
const PORT = 3000;

APP.get('/', (req, res) => res.send('Hello World!'));
APP.listen(PORT, () => console.log(`Discord QOTD app listening at http://localhost:${PORT}`));

const client = new Discord.Client({
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        // Discord.Intents.FLAGS.GUILD_MEMBERS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS
        // Discord.Intents.FLAGS.GUILD_VOICE_STATES,
    ],
});
const BOT_TOKEN = process.env.BOT_TOKEN;

let runningGames = {};

// Schedule daily cleaning using cron
// 0 0 9 * * * means 9:00 AM exactly
const cleanJob = new cron.CronJob('0 0 6 * * *', () => {
    console.log("Cleaning");
    for (const game in runningGames) {
        client.channels.cache.get(game).send(`I reset all games at 6 AM PST to avoid memory problems. The word of this game I'm cleaning up was ${runningGames[game].hotWord}.`);
    }
    runningGames = {};

}, null, true, 'America/Los_Angeles');

cleanJob.start();

const totalGuesses = 6;

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`)
})

client.on("messageCreate", msg => {
    // check if message is from waifu bot
    if (msg.content === "!wordle" || msg.content === "!discordle") {
        let [channelID, _] = GetMessageIDs(msg);
        if (runningGames.hasOwnProperty(channelID)) {
            msg.channel.send("There's already a Discordle game started.");
        } else {
            // generate a random word
            let hotWord = generateHotWord();
            console.log(hotWord)
            // Save the channel ID as the key with values {guesses: number, hotword: string}
            runningGames[channelID] = { guesses: 0, hotWord: hotWord, letters: makeLetterObject() };
            console.log(runningGames);
            msg.channel.send(`It's Disordle time! There are ${totalGuesses} guesses. \nHere's the clues: [A] = Right letter right place, (A) = Right letter wrong place. If neither, then it's an incorrect letter. \nUse !guess (yourGuess) to guess. \nUse !giveup to give up.\nDiscordle games are cleaned up every morning at 6:00 AM PST to avoid memory problems.`)
        }
    } else if (!msg.author.bot && msg.content.toLowerCase().includes("!guess")) {
        // Check to see if game is in session
        let [channelID, _] = GetMessageIDs(msg);
        if (runningGames.hasOwnProperty(channelID)) {
            const guessArray = msg.content.split(' ');
            if (guessArray.length > 1) {
                const guess = guessArray[1].toUpperCase();
                if (guess) {
                    if (guess === "DYLAN") {
                        msg.channel.send(`:tada: You guessed the creator! The repo is: <https://github.com/vu-dylan/Discordle> :tada:`);
                    } else if (checkIfvalid(guess)) {
                        const channelHotWord = runningGames[channelID].hotWord;
                        if (guess === channelHotWord) {
                            msg.channel.send(`:tada: You guessed the word! The word was: ${channelHotWord} :tada:`);
                            delete runningGames[channelID];
                        } else {
                            // increment guesses by 1
                            runningGames[channelID].guesses = runningGames[channelID].guesses + 1;
                            const result = formatGuess(guess, channelHotWord, runningGames[channelID].letters);
                            let letterList = "";
                            for (const letter in result.letters) {
                                if (result.letters[letter] === "[]") {
                                    // Right position
                                    letterList += ` **[${letter}]** `;
                                } else if (result.letters[letter] === "()") {
                                    // diff position
                                    letterList += ` **(${letter})** `;
                                } else if (result.letters[letter] === "~") {
                                    // wrong letter
                                    letterList += ` ~~${letter}~~ `;
                                } else {
                                    // not guessed yet
                                    letterList += ` ${letter} `
                                }
                            }
                            msg.channel.send(result.formatted + `\n\nLetter list: ${letterList}\n\nThere are ${totalGuesses - runningGames[channelID].guesses} guesses left.`);
                            if (runningGames[channelID].guesses >= totalGuesses) {
                                msg.channel.send(`There are no guesses left. The word was: ${channelHotWord}. If this was a hard word, blame Dylan for his word bank he stole off the internet.`);
                                delete runningGames[channelID];
                            }
                        }
                    } else {
                        if (guess.length !== 5) {
                            msg.channel.send("Your guess isn't five letters, my friend.");
                        } else {
                            msg.channel.send("I couldn't recognize that word. Are you sure that's a real word? \n\n (Or maybe I'm just dumb since I only know about 3000 five letter words. Blame Dylan for that.)");
                        }
                    }
                }
            }
        } else {
            msg.channel.send("There isn't currently a game in progress. Try `!wordle` or `!discordle` to start another one.");
        }
    } else if (msg.content === "!giveup") {
        let [channelID, _] = GetMessageIDs(msg);
        if (runningGames.hasOwnProperty(channelID)) {
            msg.channel.send(`The word was: ${runningGames[channelID].hotWord}. If this was a hard word, blame Dylan for his word bank he stole off the internet.`);
            delete runningGames[channelID];
        }
    }
})

client.login(BOT_TOKEN);