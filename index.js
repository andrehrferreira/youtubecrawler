const dotnev = require("dotenv");
const crawl = require('@ehnosso/youtubescraper');
const { MongoClient } = require('mongodb');
const axios = require('axios').default;

dotnev.config();

const client = new MongoClient(process.env.MONGODB_URI);


class Crawler {
    async init(){
        await client.connect();
        this.collection = client.db().collection('ytc');
        setInterval(() => this.getChannel(), 5000);
    }

    async getChannel(){
        if(!!client && !!client.topology && client.topology.isConnected()) {
            const channel = await this.collection.findOne({ verified: false });

            if(channel){
                try{
                    await this.collection.updateOne({ channelId: channel.channelId }, { $set: { verified: true } });
                    console.log(`https://www.youtube.com/channel/${channel.channelId}/channels`);
                    const data = await crawl.get(`https://www.youtube.com/channel/${channel.channelId}/channels`);
                    //const data = await crawl.get("https://www.youtube.com/c/RodrigoBranas/channels");
                    const links = data.getChannelsLink();

                    if(links.length > 0)
                        console.log(`Import more channels: ${links.length}`);

                    for(let link of links){
                        try{
                            await this.collection.insertOne({
                                ...link,
                                verified: false,
                                imported: false
                            });
                        }
                        catch(e){}
                    }
                }
                catch(e){}
            }
        }
    }

    async updateOrCreateChannel(){
        if(!!client && !!client.topology && client.topology.isConnected()) {
            try{
                const channel = await this.collection.findOne({ imported: false });

                if(channel.subscriberCount)
                    channel.subscriberCount = channel.subscriberCount / 100;

                if(channel){
                    let info = {};

                    if(!channel.title || !channel.avatar){
                        console.log(`Get Info ${channel.channelId}`);
                        const data = await crawl.get(`https://www.youtube.com/channel/${channel.channelId}`);
                        info = data.getChannelInfo();
                        //console.log(`Import profile`, info);

                        if(info){
                            await this.collection.updateOne({ channelId: channel.channelId }, { $set: { 
                                imported: true,
                                ...info
                            } });
                        }   
                        else{
                            await this.collection.updateOne({ channelId: channel.channelId }, { $set: { imported: true } });
                        }
                    }
                    else{
                        console.log(`Send Info Cache ${channel.name}`);
                        info = channel;
                        await this.collection.updateOne({ channelId: channel.channelId }, { $set: { imported: true } });
                    }                    

                    await axios.post('https://api.ehnosso.com.br/channel/create', info);
                    await this.updateOrCreateChannel();
                }
            }
            catch(e){
                //console.log(e.response.data);
            }
        }
    }
}

async function main() {
    const crawler = new Crawler();
    await crawler.init();
    await crawler.updateOrCreateChannel();
}

main();