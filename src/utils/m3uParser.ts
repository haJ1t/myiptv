import { Channel, ChannelGroup, M3UPlaylist } from '../types';
import axios from 'axios';

export class M3UParser {
  /**
   * M3U dosyasını parse eder (URL veya dosya içeriği)
   */
  static async parse(source: string): Promise<M3UPlaylist> {
    let content: string;

    // URL mi yoksa dosya içeriği mi kontrol et
    if (source.startsWith('http://') || source.startsWith('https://')) {
      content = await this.fetchM3U(source);
    } else {
      content = source;
    }

    const channels = this.parseContent(content);
    const groups = this.groupChannels(channels);

    return {
      channels,
      groups,
      totalChannels: channels.length
    };
  }

  /**
   * URL'den M3U dosyasını indir
   */
  private static async fetchM3U(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        responseType: 'text',
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      throw new Error(`M3U dosyası indirilemedi: ${error}`);
    }
  }

  /**
   * M3U içeriğini parse et
   */
  private static parseContent(content: string): Channel[] {
    const lines = content.split('\n').map(line => line.trim());
    const channels: Channel[] = [];
    let currentChannel: Partial<Channel> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // #EXTM3U başlığını atla
      if (line.startsWith('#EXTM3U')) {
        continue;
      }

      // #EXTINF satırı - kanal bilgileri
      if (line.startsWith('#EXTINF:')) {
        currentChannel = this.parseExtInf(line);
      }
      // URL satırı
      else if (line && !line.startsWith('#')) {
        if (currentChannel.name) {
          currentChannel.url = line;
          currentChannel.id = this.generateId(currentChannel.name, line);
          channels.push(currentChannel as Channel);
          currentChannel = {};
        }
      }
    }

    return channels;
  }

  /**
   * #EXTINF satırını parse et
   */
  private static parseExtInf(line: string): Partial<Channel> {
    const channel: Partial<Channel> = {};

    // tvg-id
    const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
    if (tvgIdMatch) channel.tvgId = tvgIdMatch[1];

    // tvg-name
    const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
    if (tvgNameMatch) channel.tvgName = tvgNameMatch[1];

    // tvg-logo
    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
    if (logoMatch) channel.logo = logoMatch[1];

    // group-title
    const groupMatch = line.match(/group-title="([^"]*)"/);
    if (groupMatch) channel.group = groupMatch[1];

    // language
    const langMatch = line.match(/tvg-language="([^"]*)"/);
    if (langMatch) channel.language = langMatch[1];

    // country
    const countryMatch = line.match(/tvg-country="([^"]*)"/);
    if (countryMatch) channel.country = countryMatch[1];

    // Kanal adı (en sondaki virgülden sonra)
    const nameMatch = line.match(/,(.+)$/);
    if (nameMatch) {
      channel.name = nameMatch[1].trim();
    }

    // Kalite tespiti (4K, 8K, HD, FHD vb.)
    const qualityMatch = channel.name?.match(/\b(8K|4K|UHD|FHD|HD|SD)\b/i);
    if (qualityMatch) {
      channel.quality = qualityMatch[1].toUpperCase();
    }

    return channel;
  }

  /**
   * Kanalları gruplara ayır
   */
  private static groupChannels(channels: Channel[]): ChannelGroup[] {
    const groupMap = new Map<string, Channel[]>();

    channels.forEach(channel => {
      const groupName = channel.group || 'Diğer';
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(channel);
    });

    return Array.from(groupMap.entries()).map(([name, channels]) => ({
      name,
      channels
    }));
  }

  /**
   * Benzersiz ID oluştur
   */
  private static generateId(name: string, url: string): string {
    const str = `${name}-${url}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * M3U dosyası oluştur (Export için)
   */
  static generate(channels: Channel[]): string {
    let m3u = '#EXTM3U\n\n';

    channels.forEach(channel => {
      let extinf = '#EXTINF:-1';
      
      if (channel.tvgId) extinf += ` tvg-id="${channel.tvgId}"`;
      if (channel.tvgName) extinf += ` tvg-name="${channel.tvgName}"`;
      if (channel.logo) extinf += ` tvg-logo="${channel.logo}"`;
      if (channel.group) extinf += ` group-title="${channel.group}"`;
      if (channel.language) extinf += ` tvg-language="${channel.language}"`;
      if (channel.country) extinf += ` tvg-country="${channel.country}"`;
      
      extinf += `,${channel.name}\n`;
      
      m3u += extinf;
      m3u += `${channel.url}\n\n`;
    });

    return m3u;
  }
}
