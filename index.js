const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const SAHIB_ID = '1076968902640275602';

async function logGonder(client, db, baslik, kullanici, yetkili, sebep) {
    if (!db.log_kanal_id) return;
    const kanal = await client.channels.fetch(db.log_kanal_id).catch(() => null);
    if (!kanal) return;

    const embed = new EmbedBuilder()
        .setTitle(baslik)
        .setColor(0xFF0000)
        .addFields(
            { name: 'Kullanıcı', value: `<@${kullanici.id}>`, inline: true },
            { name: 'Yetkili', value: `<@${yetkili.id}>`, inline: true },
            { name: 'Sebep', value: sebep || 'Belirtilmedi' }
        )
        .setTimestamp();
    
    kanal.send({ embeds: [embed] });
}

async function oyundaIslemYap(robloxUserId, islemTuru) {
    const apiler = [process.env.OYUN1_API, process.env.OYUN2_API].filter(url => url && url.length > 0);
    for (const url of apiler) {
        try {
            await axios.post(url, {
                userId: robloxUserId,
                action: islemTuru,
                secret: process.env.API_KEY
            });
        } catch (e) {
            console.log(`Hata: ${url} - ${e.message}`);
        }
    }
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isModalSubmit()) return;

    let db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));

    if (!db.yetkililer) db.yetkililer = [];
    if (!db.bas_yetkililer) db.bas_yetkililer = [];
    if (!db.holderlar) db.holderlar = [];
    if (!db.yasakli_kullanicilar) db.yasakli_kullanicilar = [];
    if (!db.yasakli_sunucular) db.yasakli_sunucular = [];
    if (!db.otomesajlar) db.otomesajlar = {};

    const isSahip = interaction.user.id === SAHIB_ID;
    const isBasYetkili = db.bas_yetkililer.includes(interaction.user.id) || isSahip;
    const isHolder = db.holderlar.includes(interaction.user.id) || isBasYetkili;
    const isYetkili = db.yetkililer.includes(interaction.user.id) || isHolder;

    if (interaction.isChatInputCommand()) {
        // --- HOLDER SİSTEMİ ---
        if (interaction.commandName === 'holder-ekle') {
            if (!isHolder) return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
            const hedef = interaction.options.getUser('kullanici');
            if (!db.holderlar.includes(hedef.id)) {
                db.holderlar.push(hedef.id);
                fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
                interaction.reply(`${hedef.tag} artık Holder yetkisine sahip.`);
            }
        }
        if (interaction.commandName === 'holder-kaldir') {
            if (!isHolder) return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
            const hedef = interaction.options.getUser('kullanici');
            db.holderlar = db.holderlar.filter(id => id !== hedef.id);
            fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
            interaction.reply(`${hedef.tag} kullanıcısının Holder yetkisi alındı.`);
        }
        if (interaction.commandName === 'holder-listele') {
            if (!isYetkili) return interaction.reply({ content: 'Yetkin yok.', ephemeral: true });
            interaction.reply(`**Holder Listesi:**\n${db.holderlar.map(id => `<@${id}>`).join('\n') || 'Yok.'}`);
        }
    }
    
    if (interaction.isChatInputCommand()) {
        // --- AF-BAN ---
        if (interaction.commandName === 'af-ban') {
            if (!isBasYetkili) return interaction.reply({ content: 'Bu komutu sadece Baş Yetkililer kullanabilir!', ephemeral: true });
            
            await interaction.deferReply();
            
            const hedef = interaction.options.getUser('kullanici');
            const sebep = interaction.options.getString('sebep');
            
            db.yasakli_kullanicilar.push(hedef.id);
            fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
            
            await oyundaIslemYap(hedef.id, 'ban');
            
            let sunucuListesi = "";
            for (const guildId of db.yasakli_sunucular) {
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    try {
                        await guild.members.ban(hedef.id, { reason: sebep });
                        sunucuListesi += `| ${guild.name}\n`;
                    } catch (e) { console.log(`${guild.name} ban başarısız.`); }
                }
            }

            // Log Kanalına gönderilecek Embed
            const logEmbed = new EmbedBuilder()
                .setTitle('AF-BAN İşlemi Gerçekleşti')
                .setColor(0xFF0000)
                .addFields(
                    { name: 'Kullanıcı', value: `<@${hedef.id}>`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Sebep', value: sebep || 'Belirtilmedi' },
                    { name: 'Etkilenen Sunucular', value: sunucuListesi || 'Sunucu bulunamadı.' }
                )
                .setTimestamp();
            
            // Log kanalını bul ve gönder
            if (db.log_kanal_id) {
                const logKanal = client.channels.cache.get(db.log_kanal_id);
                if (logKanal) {
                    logKanal.send({ embeds: [logEmbed] });
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('İşlemler Tamamlandı')
                .setColor(0x0099FF)
                .setDescription(`<@${hedef.id}> kullanıcısı aşağıdaki sunucularda yasaklandı:\n\n${sunucuListesi}\n**İşlem:** Yasaklandı.\n**Yetkili:** ${interaction.user.username}\n${new Date().toLocaleDateString('tr-TR')}`);
            
            await interaction.editReply({ embeds: [embed] });
        }
        // --- AF-BAN KALDIR ---
        if (interaction.commandName === 'af-ban-kaldir') {
            if (!isBasYetkili) return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
            
            const hedefId = interaction.options.getString('id');
            await interaction.deferReply();
            
            db.yasakli_kullanicilar = db.yasakli_kullanicilar.filter(id => id !== hedefId);
            fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
            
            await oyundaIslemYap(hedefId, 'unban');
            
            let sunucuListesi = "";
            for (const guildId of db.yasakli_sunucular) {
                const guild = client.guilds.cache.get(guildId);
                if (guild) { 
                    try { 
                        await guild.members.unban(hedefId); 
                        sunucuListesi += `| ${guild.name}\n`;
                    } catch (e) { console.log(`${guild.name} ban kaldırma başarısız.`); } 
                }
            }

            // Log Kanalına gönderilecek Embed
            const logEmbed = new EmbedBuilder()
                .setTitle('AF-BAN Kaldırma İşlemi Gerçekleşti')
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Kullanıcı ID', value: hedefId, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Etkilenen Sunucular', value: sunucuListesi || 'Sunucu bulunamadı.' }
                )
                .setTimestamp();
            
            // Log kanalını bul ve gönder
            if (db.log_kanal_id) {
                const logKanal = client.channels.cache.get(db.log_kanal_id);
                if (logKanal) {
                    logKanal.send({ embeds: [logEmbed] });
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('İşlemler Tamamlandı')
                .setColor(0x0099FF)
                .setDescription(`<@${hedefId}> kullanıcısının yasakları kaldırıldı:\n\n${sunucuListesi}\n**İşlem:** Yasak kaldırıldı.\n**Yetkili:** ${interaction.user.username}\n${new Date().toLocaleDateString('tr-TR')}`);
            
            await interaction.editReply({ embeds: [embed] });
        }
        // --- TAM YASAKLA ---
        if (interaction.commandName === 'tam-yasakla') {
            if (!isYetkili) return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
            
            await interaction.deferReply();
            
            const hedef = interaction.options.getUser('kullanici');
            const sebep = interaction.options.getString('sebep');
            
            // 1. DM GÖNDERME (Görseldeki formatta)
            try {
                const targetUser = await client.users.fetch(hedef.id);
                const dmEmbed = new EmbedBuilder()
                    .setTitle('Yasaklandın')
                    .setColor(0xFF0000) // Kırmızı sol şerit
                    .setDescription(`| **${interaction.guild.name}** sunucusundan yasaklandın.\n\n**Sebep:** ${sebep}\n**Banlayan:** ${interaction.user.username}\n\nHaksız olduğunu düşünüyorsan itiraz için: discord.gg/ittifakordusu adresine gelip ticket açabilirsin.`);
                
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (e) {
                console.log("Kullanıcıya DM atılamadı.");
            }
            
            // 2. İşlemler
            db.yasakli_kullanicilar.push(hedef.id);
            fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
            
            try { await oyundaIslemYap(hedef.id, 'ban'); } catch (e) {}
            try { await interaction.guild.members.ban(hedef.id, { reason: sebep }); } catch (e) {}

            // 3. Log Sistemi
            const logEmbed = new EmbedBuilder()
                .setTitle('Yasaklama İşlemi')
                .setColor(0xFF0000)
                .addFields(
                    { name: 'Kullanıcı', value: `<@${hedef.id}>`, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Sebep', value: sebep || 'Belirtilmedi' }
                )
                .setTimestamp();
            
            if (db.log_kanal_id) {
                const logKanal = client.channels.cache.get(db.log_kanal_id);
                if (logKanal) logKanal.send({ embeds: [logEmbed] });
            }
            
            // 4. Komut cevap Embed'i (Kendi orijinal tasarımı bozulmadı)
            const embed = new EmbedBuilder()
                .setTitle('İşlemler Tamamlandı')
                .setColor(0x0099FF)
                .setDescription(`<@${hedef.id}> kullanıcısı yasaklandı:\n\n| ${interaction.guild.name}\n| Oyun Sunucuları\n\n**İşlem:** Yasaklandı.\n**Yetkili:** ${interaction.user.username}\n${new Date().toLocaleDateString('tr-TR')}`);
            
            await interaction.editReply({ embeds: [embed] });
        }
        // --- TAM YASAKLA KALDIR ---
        if (interaction.commandName === 'tam-yasakla-kaldir') {
            if (!isYetkili) return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
            
            const hedefId = interaction.options.getString('id');
            await interaction.deferReply();
            
            // Veritabanından sil ve kaydet
            db.yasakli_kullanicilar = db.yasakli_kullanicilar.filter(id => id !== hedefId);
            fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
            
             try {
                const targetUser = await client.users.fetch(hedefId);
                const dmEmbed = new EmbedBuilder()
                    .setTitle('Yasak Kaldırıldı')
                    .setColor(0x00FF00) // Yeşil şerit
                    .setDescription(`| **${interaction.guild.name}** sunucusundan yasağın kaldırıldı.\n\n**Açan:** ${interaction.user.username}\n\nUmarım Artık Kurallara Uyarsın.`);
                
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (e) {
                console.log("Kullanıcıya DM atılamadı (DM kapalı veya botu engellemiş).");
            }
            // Oyun ve Discord işlemleri
            try { await oyundaIslemYap(hedefId, 'unban'); } catch (e) {}
            try { await interaction.guild.members.unban(hedefId, "Yasak yetkili tarafından kaldırıldı."); } catch (e) {}
            
            // Log Kanalına gönderilecek Embed
            const logEmbed = new EmbedBuilder()
                .setTitle('Yasak Kaldırma İşlemi')
                .setColor(0x00FF00) // Yeşil renk
                .addFields(
                    { name: 'Kullanıcı ID', value: hedefId, inline: true },
                    { name: 'Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Durum', value: 'Yasak başarıyla kaldırıldı.' }
                )
                .setTimestamp();
            
            // Log kanalını bul ve gönder
            if (db.log_kanal_id) {
                const logKanal = client.channels.cache.get(db.log_kanal_id);
                if (logKanal) {
                    logKanal.send({ embeds: [logEmbed] });
                }
            }
            
            // Komutu kullanan kişiye cevap embed'i
            const embed = new EmbedBuilder()
                .setTitle('İşlemler Tamamlandı')
                .setColor(0x0099FF)
                .setDescription(`<@${hedefId}> kullanıcısının yasağı kaldırıldı:\n\n| ${interaction.guild.name}\n| Oyun Sunucuları\n\n**İşlem:** Yasak kaldırıldı.\n**Yetkili:** ${interaction.user.username}\n${new Date().toLocaleDateString('tr-TR')}`);
            
            await interaction.editReply({ embeds: [embed] });
        }

        // --- BAŞ YETKİLİ KOMUTLARI ---
        if (interaction.commandName === 'bas-yetkili-ekle') {
            if (!isSahip) return interaction.reply({ content: 'Sadece Sahip.', ephemeral: true });
            const hedef = interaction.options.getUser('kullanici');
            if (!db.bas_yetkililer.includes(hedef.id)) { db.bas_yetkililer.push(hedef.id); fs.writeFileSync('./database.json', JSON.stringify(db, null, 2)); interaction.reply(`${hedef.tag} eklendi.`); }
        }
        if (interaction.commandName === 'bas-yetkili-kaldir') {
            if (!isSahip) return interaction.reply({ content: 'Sadece Sahip.', ephemeral: true });
            const hedef = interaction.options.getUser('kullanici');
            db.bas_yetkililer = db.bas_yetkililer.filter(id => id !== hedef.id); fs.writeFileSync('./database.json', JSON.stringify(db, null, 2)); interaction.reply(`${hedef.tag} kaldırıldı.`);
        }
        if (interaction.commandName === 'bas-yetkili-listele') {
            if (!isBasYetkili) return interaction.reply({ content: 'Yetkin yok.', ephemeral: true });
            interaction.reply(`**Baş Yetkililer:**\n${db.bas_yetkililer.map(id => `<@${id}>`).join('\n')}`);
        }

        if (interaction.commandName === 'log-kanal-ayarla') {
            if (!isSahip) return interaction.reply({ content: 'Sadece Sahip.', ephemeral: true });
            const kanal = interaction.options.getChannel('kanal');
            db.log_kanal_id = kanal.id;
            fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
            interaction.reply(`Log kanalı <#${kanal.id}> olarak ayarlandı.`);
        }

        // --- YETKİLİ KOMUTLARI ---
        if (interaction.commandName === 'yetkili-ekle') {
            if (!isBasYetkili) return interaction.reply({ content: 'Yetkin yok.', ephemeral: true });
            const hedef = interaction.options.getUser('kullanici');
            if (!db.yetkililer.includes(hedef.id)) { db.yetkililer.push(hedef.id); fs.writeFileSync('./database.json', JSON.stringify(db, null, 2)); interaction.reply(`${hedef.tag} eklendi.`); }
        }
        if (interaction.commandName === 'yetkili-kaldir') {
            if (!isBasYetkili) return interaction.reply({ content: 'Yetkin yok.', ephemeral: true });
            const hedef = interaction.options.getUser('kullanici');
            db.yetkililer = db.yetkililer.filter(id => id !== hedef.id); fs.writeFileSync('./database.json', JSON.stringify(db, null, 2)); interaction.reply(`${hedef.tag} kaldırıldı.`);
        }
        if (interaction.commandName === 'yetkili-listele') {
            if (!isYetkili) return interaction.reply({ content: 'Yetkin yok.', ephemeral: true });
            interaction.reply(`**Yetkililer:**\n${db.yetkililer.map(id => `<@${id}>`).join('\n')}`);
        }
        // --- OTOMESAJ ---
        if (interaction.commandName === 'otomesaj') {
            if (!isBasYetkili) return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ekle_btn').setLabel('Cevap Ekle').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('sil_btn').setLabel('Cevap Sil').setStyle(ButtonStyle.Danger)
            );
            interaction.reply({ embeds: [new EmbedBuilder().setTitle('Otomatik Cevap Yönetimi')], components: [row], ephemeral: true });
        }
    }
    // Butonlar ve Modal
    if (interaction.isButton() && interaction.customId === 'ekle_btn') {
        const modal = new ModalBuilder().setCustomId('ekle_modal').setTitle('Yeni Otomatik Cevap');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tetikleyici').setLabel('Tetikleyici').setStyle(TextInputStyle.Short)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cevap').setLabel('Cevap').setStyle(TextInputStyle.Paragraph))
        );
        await interaction.showModal(modal);
    }
    if (interaction.isModalSubmit() && interaction.customId === 'ekle_modal') {
        const tetik = interaction.fields.getTextInputValue('tetikleyici').toLowerCase();
        const cevap = interaction.fields.getTextInputValue('cevap');
        db.otomesajlar[tetik] = cevap;
        fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
        interaction.reply({ content: '✅ Başarıyla eklendi.', ephemeral: true });
    }
});

client.on('messageCreate', message => {
    if (message.author.bot) return;
    let db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    if (db.otomesajlar[message.content.toLowerCase()]) message.reply(db.otomesajlar[message.content.toLowerCase()]);
});

client.login(process.env.TOKEN);