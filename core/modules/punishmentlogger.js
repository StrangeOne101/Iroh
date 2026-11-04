const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const API = require('../api');
const configJS = require('../config.js');
const bot = require('../../bot.js');

const punishmentChannel = configJS.getPunishmentChannel();

const SearchTimeFrame = 600000 // search for audit logs made with the last 10 minutes
const auditLogDelay = 2000; // sleep for 2 seconds to ensure discord finishes adding the audit log before we retrieve
const processedLogs = new Set();
const logLimit = 5;

async function sendEmbed(action ,content, executor, target, punishDate){
    const channel = await API.getChannel(punishmentChannel).catch(() => null);
    if (!channel){
        console.log("channel could not be found");
        return;
    }
    let fancyDate;
    if (punishDate != null){
        fancyDate = getFancyDate(punishDate);
    } else {
        fancyDate = "Never"
    }
    const embed = new EmbedBuilder()
        .setColor(0xFFFF47) // Red color for a deletion alert
        .setTitle(action)
        .addFields(
            { name: '💬 Information', value: `\`\`\`${content.slice(0, 1024)}\`\`\``, inline: false },// contains message content or reason
            { name: '👤 User', value: `${target || "Unknown User"}`, inline: true },
            { name: '🛡️ Moderator', value: `${executor || "Unknown Moderator"}`, inline: true },
            { name: '⏳ Expires', value: fancyDate, inline: true},
        )
        .setTimestamp();

    await channel.send({ embeds: [embed] });
}

function getFancyDate(date){
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = months[date.getMonth()].slice(0,3);
    const day = String(date.getDate());
    const year = date.getFullYear();
    fancyDate = `${month} ${day}, ${year}`.toString();
    return fancyDate;
}

async function onMessageDelete(message){
    if (!message.guild) return;
    if (message.author.bot)return;
    const messageContent = message.content || "No content cached";
    setTimeout(async () => {
        try {
            const fetchedLogs = await message.guild.fetchAuditLogs({
                limit: logLimit,
                type: AuditLogEvent.MessageDelete,
            });

            const log = fetchedLogs.entries.find(entry => {
                const isRecent = Date.now() - entry.createdTimestamp < SearchTimeFrame;
                const matchesChannel = entry.extra.channel.id === message.channel.id;
                return isRecent && matchesChannel;
            });
            
            if (log) {
                const executor = log ? log.executor : "Unknown Moderator";
                const target = log ? log.target : "Unknown User";
                console.log(`Message authored by : ${target.tag} was deleted by moderator: ${executor.tag} with content ${messageContent}`);
                await sendEmbed('🗑️ Message Deleted', messageContent, executor, target, null);
            } else {
                console.log(`No audit log found. The user likely deleted their own message.`);
            }
            
        } catch (error) {
            console.error('failed to fetch audit logs', error);
        }

    }, auditLogDelay);
}

async function onMemberUpdate(oldMember, newMember){//member timeouts and untimeouts
    const oldTimeout = oldMember.communicationDisabledUntilTimestamp || 0;
    const newTimeout = newMember.communicationDisabledUntilTimestamp;
    if (newTimeout && newTimeout > Date.now() && (!oldTimeout || newTimeout > oldTimeout)) {
        setTimeout( async () => {
            try {
                const fetchedLogs = await newMember.guild.fetchAuditLogs({
                    limit: logLimit,
                    type: AuditLogEvent.MemberUpdate,
                });

                const log = fetchedLogs.entries.find(entry => 
                    entry.target.id === newMember.id && Date.now() - entry.createdTimestamp < SearchTimeFrame
                );

                const executor = log ? log.executor : "Unknown Moderator";
                const target = newMember ? newMember.user : "Unknown User";
                const reason = log ? log.reason || "No reason provided" : "No reason provided";
                const timeoutUntil = new Date(newTimeout);
                await sendEmbed("⏱️ Member Timed Out", reason, executor, target, timeoutUntil);
            } catch (error){
                console.error('failed to fetch timeout audit log', error);
            }
        }, auditLogDelay);
    }
    const isNowCleared = !newTimeout || newTimeout <= Date.now();

    if (isNowCleared){
        setTimeout(async () => {
            try{
                const fetchedLogs = await newMember.guild.fetchAuditLogs({
                    limit: logLimit,
                    type: AuditLogEvent.MemberUpdate,
                });
                
                const log = fetchedLogs.entries.find(entry => {
                    const isTarget = entry.target?.id === newMember.id;
                    const isRecent = Date.now() - entry.createdTimestamp < SearchTimeFrame;
                    
                    const timeoutChange = entry.changes?.find(c => c.key === 'communication_disabled_until');
                    
                    // An untimeout has an 'old' timestamp value, but no 'new' property (or new is null/undefined)
                    const isUntimeout = timeoutChange && timeoutChange.old && !timeoutChange.new;

                    return isTarget && isRecent && isUntimeout;
                });
                
                //Prevent duplicate member timeout messages from happening
                if (!log) {
                    console.log("No untimeout audit log found.");
                    return;
                }
                if (processedLogs.has(log.id)) {
                    return;
                }
                processedLogs.add(log.id);
                setTimeout(() => processedLogs.delete(log.id), 600000);
                
                const executor = log ? log.executor : "Unknown Moderator";
                const target = newMember ? newMember.user : "Unknown User";

                sendEmbed("❌ Timeout Removed","Removed by Moderator", executor, target, new Date());
                
            } catch (error){
                console.error("failed to fetch untimeout audit log", error);
            }
        }, auditLogDelay);
    }
}

async function onGuildBanAdd(ban) {
    const guild = ban.guild;
    const member = ban.user;
    setTimeout(async () => {
        try {
            const fetchedLogs = await guild.fetchAuditLogs({
                limit: logLimit,
                type: AuditLogEvent.MemberBanAdd,
            });

            const log = fetchedLogs.entries.find(entry => 
                entry.target?.id === member.id && Date.now() - entry.createdTimestamp < SearchTimeFrame
            );

            const executor = log ? log.executor : "Unknown Moderator";
            const target = log ? log.target : "Unknown User";
            const reason = log ? log.reason || "No reason provided" : "No reason provided";

            sendEmbed("🔨 Member Banned", reason, executor, target, null);
        } catch (error){
            console.error("failed to fetch ban audit log",error);
        }
    }, auditLogDelay);
}

async function onGuildBanRemove(ban) {
    const guild = ban.guild;
    const member = ban.user;
    setTimeout(async () => {
        try {
            const fetchedLogs = await guild.fetchAuditLogs({
                limit: logLimit,
                type: AuditLogEvent.MemberBanAdd,
            });

            const log = fetchedLogs.entries.find(entry => 
                entry.target?.id === member.id && Date.now() - entry.createdTimestamp < SearchTimeFrame
            );

            const executor = log ? log.executor : "Unknown Moderator";
            const target = log ? log.target : "Unknown User";
            const reason = log ? log.reason || "No reason provided" : "No reason provided";

            sendEmbed("🤝 Member Unbanned", reason, executor, target, new Date());
        } catch (error){
            console.error("failed to fetch unban audit log",error);
        }
    }, auditLogDelay);
}

async function onGuildMemberRemove(member) {
    setTimeout(async () => {
        try {
            const fetchedLogs = await member.guild.fetchAuditLogs({
                limit: logLimit,
                type: AuditLogEvent.MemberKick,
            });

            const log = fetchedLogs.entries.find(entry => 
                entry.target?.id === member.id && Date.now() - entry.createdTimestamp < SearchTimeFrame
            );

            // If an audit log entry is found, it means the user was kicked (otherwise they left voluntarily)
            if (log) {
                const executor = log.executor || "Unknown Moderator";
                const target = log.target || member.user || "Unknown User";
                const reason = log.reason || "No reason provided";

                sendEmbed("👢 Member Kicked", reason, executor, target, null);
            }
        } catch (error) {
            console.error("failed to fetch kick audit log", error);
        }
    }, auditLogDelay);
}

//bans unbans kicks

API.subscribe("messageDelete", onMessageDelete);
API.subscribe("guildMemberUpdate", onMemberUpdate);
API.subscribe("guildBanAdd", onGuildBanAdd);
API.subscribe("guildBanRemove", onGuildBanRemove);
API.subscribe("guildMemberRemove", onGuildMemberRemove);

module.exports = {
    onMessageDelete,
    onMemberUpdate,
    onGuildBanAdd,
    onGuildBanRemove,
    onGuildMemberRemove
};
