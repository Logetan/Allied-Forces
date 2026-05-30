const { SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
require('dotenv').config();

const commands = [
    // --- MEVCUT KOMUTLARIN ---
    new SlashCommandBuilder().setName('af-ban').setDescription('Kullanıcıyı tüm platformlardan yasaklar.')
        .addUserOption(option => option.setName('kullanici').setDescription('Yasaklanacak kişi').setRequired(true))
        .addStringOption(option => option.setName('sebep').setDescription('Ban sebebi').setRequired(true)),
    
    new SlashCommandBuilder().setName('af-ban-kaldir').setDescription('Yasağı kaldırır.')
        .addStringOption(option => option.setName('id').setDescription('Kullanıcı ID').setRequired(true)),

    new SlashCommandBuilder().setName('tam-yasakla').setDescription('Sunucudan ve oyundan yasaklar.')
        .addUserOption(option => option.setName('kullanici').setDescription('Yasaklanacak kişi').setRequired(true))
        .addStringOption(option => option.setName('sebep').setDescription('Sebep').setRequired(true)),

    new SlashCommandBuilder().setName('tam-yasakla-kaldir').setDescription('Yasağı kaldırır.')
        .addStringOption(option => option.setName('id').setDescription('Kullanıcı ID').setRequired(true)),

    // --- YETKİ KOMUTLARI ---
    new SlashCommandBuilder().setName('bas-yetkili-ekle').setDescription('Baş yetkili ekler.')
        .addUserOption(option => option.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    new SlashCommandBuilder().setName('bas-yetkili-kaldir').setDescription('Baş yetkili kaldırır.')
        .addUserOption(option => option.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    new SlashCommandBuilder().setName('bas-yetkili-listele').setDescription('Baş yetkilileri listeler.'),

    new SlashCommandBuilder().setName('yetkili-ekle').setDescription('Yetkili ekler.')
        .addUserOption(option => option.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    new SlashCommandBuilder().setName('yetkili-kaldir').setDescription('Yetkili kaldırır.')
        .addUserOption(option => option.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    new SlashCommandBuilder().setName('yetkili-listele').setDescription('Yetkilileri listeler.'),

    // --- HOLDER KOMUTLARI ---
    new SlashCommandBuilder().setName('holder-ekle').setDescription('Holder ekler.')
        .addUserOption(option => option.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    new SlashCommandBuilder().setName('holder-kaldir').setDescription('Holder kaldırır.')
        .addUserOption(option => option.setName('kullanici').setDescription('Kullanıcı').setRequired(true)),
    new SlashCommandBuilder().setName('holder-listele').setDescription('Holder listeler.'),

    // --- OTOMESAJ KOMUTU (EKLEDİK) ---
    new SlashCommandBuilder().setName('otomesaj').setDescription('Otomatik mesaj yönetim panelini açar.'),

    new SlashCommandBuilder().setName('log-kanal-ayarla').setDescription('Log kanalını ayarlar.')
    .addChannelOption(option => option.setName('kanal').setDescription('Log kanalı').setRequired(true)),

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Komutlar yükleniyor...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('Tüm komutlar başarıyla yüklendi!');
    } catch (error) {
        console.error(error);
    }
})();