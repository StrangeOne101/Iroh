const configJS = require('../config.js');
const API = require("../api.js")
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const punishmentChannel = configJS.getPunishmentChannel();

module.exports = {
    name: "history",
    usage: "history @User (mod/user) (EntryNumber)",
    description: "search punishment by user or moderator",
    disabled: false,
    canUse: function(sender) {
        return API.isModerator(sender.id,punishmentChannel);
    },
    run: async function(messageObj, channel, sender, args){
        if (!args || args.length === 0 || !args[0]) {
            return messageObj.reply("❌ Usage: `" + module.exports.usage + "`");
        }

        const punishmentChannel = configJS.getPunishmentChannel();
        const targetChannel = await messageObj.client.channels.fetch(punishmentChannel).catch(() => null);

        if (!targetChannel) {
            return messageObj.reply("❌ Could not find the punishment log channel.");
        }

        // Parse query and mode
        let searchId = args[0].replace(/[<@!>]/g, '');
        let mode = "user"; // default mode

        // Check if a second argument or a mode flag was provided
        if (args[1]) {
            if (args[1].toLowerCase().startsWith("mode:")) {
                mode = args[1].split(":")[1].toLowerCase();
            } else if (args[1].toLowerCase() === "mod" || args[1].toLowerCase() === "user") {
                mode = args[1].toLowerCase();
            }
        }

        try {
            // Fetch recent logs from the punishment channel
            const messages = await targetChannel.messages.fetch({ limit: 100 });

            const matches = Array.from(messages.values()).filter(msg => {
                if (msg.embeds.length === 0) return false;
                const embed = msg.embeds[0];
                if (msg.content.includes("History Entry")) return false;
                if (mode === "mod") {
                    const modField = embed.fields.find(f => f.name.includes('Moderator'));
                    return modField ? modField.value.includes(searchId) : false;
                } else {
                    const userField = embed.fields.find(f => f.name.includes('User'));
                    return userField ? userField.value.includes(searchId) : false;
                }
            });

            if (matches.length === 0) {
                return messageObj.reply(`🔍 No punishment history found for that ${mode === "mod" ? "moderator" : "user"}.`);
            }

            let currentIndex = 0;
            const totalMatches = matches.length;

            // Helper function to generate components and payload based on index
            const generatePayload = (index) => {
                const prevButton = new ButtonBuilder()
                    .setCustomId('prev_history')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(index === 0);

                const nextButton = new ButtonBuilder()
                    .setCustomId('next_history')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(index === totalMatches - 1);

                const row = new ActionRowBuilder().addComponents(prevButton, nextButton);

                return {
                    content: `# History Entry ${index + 1}/${totalMatches}`,
                    embeds: [matches[index].embeds[0]],
                    components: totalMatches > 1 ? [row] : [],
                    allowedMentions: { repliedUser: false }
                };
            };

            const initialPayload = generatePayload(currentIndex);
            const sentMessage = await messageObj.reply(initialPayload);

            // If there's only 1 match, we don't need a button collector
            if (totalMatches <= 1) return;

            // Create a collector for the buttons (active for 2 minutes)
            const collector = sentMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000 
            });

            collector.on('collect', async interaction => {
                // Ensure only the user who ran the command can use the buttons
                if (interaction.user.id !== (messageObj.author?.id || messageObj.user?.id)) {
                    return interaction.reply({ content: "❌ You cannot use these buttons.", ephemeral: true });
                }

                if (interaction.customId === 'prev_history') {
                    if (currentIndex > 0) currentIndex--;
                } else if (interaction.customId === 'next_history') {
                    if (currentIndex < totalMatches - 1) currentIndex++;
                }

                await interaction.update(generatePayload(currentIndex));
            });

            collector.on('end', async () => {
                // Disable buttons after timeout expires
                const disabledPrev = new ButtonBuilder().setCustomId('prev_history').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(true);
                const disabledNext = new ButtonBuilder().setCustomId('next_history').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(true);
                const disabledRow = new ActionRowBuilder().addComponents(disabledPrev, disabledNext);

                try {
                    await sentMessage.edit({ components: [disabledRow] });
                } catch (err) {
                    // Message might have been deleted
                }
            });

        } catch (error) {
            console.error("Failed to search punishment history:", error);
            messageObj.reply("❌ An error occurred while searching punishment history.");
        }
    }
};