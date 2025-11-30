import axios from 'axios';
import {
  XtreamCredentials,
  XtreamAuthInfo,
  XtreamCategory,
  XtreamChannel,
  XtreamVOD,
  XtreamSeries,
  Channel,
  M3UPlaylist,
  ChannelGroup
} from '../types';

export class XtreamParser {
  private credentials: XtreamCredentials;
  private authInfo: XtreamAuthInfo | null = null;

  constructor(credentials: XtreamCredentials) {
    // URL'den trailing slash'i kaldır
    this.credentials = {
      ...credentials,
      serverUrl: credentials.serverUrl.replace(/\/$/, '')
    };
  }

  /**
   * Kimlik doğrulama ve sunucu bilgilerini al
   */
  async authenticate(): Promise<XtreamAuthInfo> {
    try {
      const url = `${this.credentials.serverUrl}/player_api.php`;
      const response = await axios.get(url, {
        params: {
          username: this.credentials.username,
          password: this.credentials.password
        },
        timeout: 30000
      });

      if (!response.data || !response.data.user_info) {
        throw new Error('Geçersiz kimlik bilgileri!');
      }

      if (response.data.user_info.auth !== 1) {
        throw new Error('Kimlik doğrulama başarısız!');
      }

      this.authInfo = response.data;
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Sunucu bulunamadı! URL\'yi kontrol edin.');
      }
      throw new Error(error.message || 'Bağlantı hatası!');
    }
  }

  /**
   * Canlı TV kategorilerini al
   */
  async getLiveCategories(): Promise<XtreamCategory[]> {
    const url = `${this.credentials.serverUrl}/player_api.php`;
    const response = await axios.get(url, {
      params: {
        username: this.credentials.username,
        password: this.credentials.password,
        action: 'get_live_categories'
      },
      timeout: 30000
    });
    return response.data || [];
  }

  /**
   * Canlı TV kanallarını al
   */
  async getLiveStreams(categoryId?: string): Promise<XtreamChannel[]> {
    const url = `${this.credentials.serverUrl}/player_api.php`;
    const params: any = {
      username: this.credentials.username,
      password: this.credentials.password,
      action: 'get_live_streams'
    };

    if (categoryId) {
      params.category_id = categoryId;
    }

    const response = await axios.get(url, { 
      params,
      timeout: 30000 
    });
    return response.data || [];
  }

  /**
   * VOD kategorilerini al
   */
  async getVODCategories(): Promise<XtreamCategory[]> {
    const url = `${this.credentials.serverUrl}/player_api.php`;
    const response = await axios.get(url, {
      params: {
        username: this.credentials.username,
        password: this.credentials.password,
        action: 'get_vod_categories'
      },
      timeout: 30000
    });
    return response.data || [];
  }

  /**
   * VOD içeriklerini al
   */
  async getVODStreams(categoryId?: string): Promise<XtreamVOD[]> {
    const url = `${this.credentials.serverUrl}/player_api.php`;
    const params: any = {
      username: this.credentials.username,
      password: this.credentials.password,
      action: 'get_vod_streams'
    };

    if (categoryId) {
      params.category_id = categoryId;
    }

    const response = await axios.get(url, { 
      params,
      timeout: 30000 
    });
    return response.data || [];
  }

  /**
   * Dizi kategorilerini al
   */
  async getSeriesCategories(): Promise<XtreamCategory[]> {
    const url = `${this.credentials.serverUrl}/player_api.php`;
    const response = await axios.get(url, {
      params: {
        username: this.credentials.username,
        password: this.credentials.password,
        action: 'get_series_categories'
      },
      timeout: 30000
    });
    return response.data || [];
  }

  /**
   * Dizileri al
   */
  async getSeries(categoryId?: string): Promise<XtreamSeries[]> {
    const url = `${this.credentials.serverUrl}/player_api.php`;
    const params: any = {
      username: this.credentials.username,
      password: this.credentials.password,
      action: 'get_series'
    };

    if (categoryId) {
      params.category_id = categoryId;
    }

    const response = await axios.get(url, { 
      params,
      timeout: 30000 
    });
    return response.data || [];
  }

  /**
   * Xtream kanallarını M3U formatına çevir
   */
  async convertToM3U(): Promise<M3UPlaylist> {
    // Önce kimlik doğrula
    await this.authenticate();

    // Kategorileri ve kanalları al
    const [categories, streams] = await Promise.all([
      this.getLiveCategories(),
      this.getLiveStreams()
    ]);

    console.log(`📡 ${streams.length} kanal alındı`);

    // Kategori map oluştur
    const categoryMap = new Map<string, string>();
    categories.forEach(cat => {
      categoryMap.set(cat.category_id, cat.category_name);
    });

    // Kanalları dönüştür
    const channels: Channel[] = streams.map(stream => {
      // ✅ DÜZELTME: .m3u8 formatını kullan (daha stabil)
      const streamUrl = this.buildStreamUrl(stream.stream_id, 'm3u8');
      const categoryName = categoryMap.get(stream.category_id) || 'Diğer';

      return {
        id: `xtream_${stream.stream_id}`,
        name: stream.name,
        url: streamUrl,
        logo: stream.stream_icon,
        group: categoryName,
        tvgId: stream.epg_channel_id || undefined,
        tvgName: stream.name,
        quality: this.detectQuality(stream.name)
      };
    });

    console.log(`✅ ${channels.length} kanal dönüştürüldü`);

    // Gruplara ayır
    const groups = this.groupChannels(channels);

    console.log(`📁 ${groups.length} grup oluşturuldu`);

    return {
      channels,
      groups,
      totalChannels: channels.length
    };
  }

  /**
   * Stream URL'i oluştur
   * ✅ DÜZELTME: Varsayılan olarak .m3u8 kullan
   */
  private buildStreamUrl(streamId: number, extension: string = 'm3u8'): string {
    return `${this.credentials.serverUrl}/live/${this.credentials.username}/${this.credentials.password}/${streamId}.${extension}`;
  }

  /**
   * VOD URL'i oluştur
   */
  buildVODUrl(streamId: number, extension: string = 'mp4'): string {
    return `${this.credentials.serverUrl}/movie/${this.credentials.username}/${this.credentials.password}/${streamId}.${extension}`;
  }

  /**
   * Dizi URL'i oluştur
   */
  buildSeriesUrl(seriesId: number, seasonNum: number, episodeNum: number, extension: string = 'mp4'): string {
    return `${this.credentials.serverUrl}/series/${this.credentials.username}/${this.credentials.password}/${seriesId}/${seasonNum}/${episodeNum}.${extension}`;
  }

  /**
   * Kalite tespiti
   */
  private detectQuality(name: string): string | undefined {
    const qualityMatch = name.match(/\b(8K|4K|UHD|FHD|HD|SD)\b/i);
    return qualityMatch ? qualityMatch[1].toUpperCase() : undefined;
  }

  /**
   * Kanalları gruplara ayır
   */
  private groupChannels(channels: Channel[]): ChannelGroup[] {
    const groupMap = new Map<string, Channel[]>();

    channels.forEach(channel => {
      const groupName = channel.group || 'Diğer';
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(channel);
    });

    // Gruplara dönüştür ve alfabetik sırala
    const groups = Array.from(groupMap.entries()).map(([name, channels]) => ({
      name,
      channels: channels.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    }));

    // Grupları alfabetik sırala
    return groups.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }

  /**
   * Kimlik bilgilerini test et
   */
  static async testConnection(credentials: XtreamCredentials): Promise<boolean> {
    try {
      const parser = new XtreamParser(credentials);
      await parser.authenticate();
      return true;
    } catch (error) {
      console.error('❌ Bağlantı testi başarısız:', error);
      return false;
    }
  }

  /**
   * Stream URL'ini farklı formatlarda al
   */
  getStreamUrlVariants(streamId: number): string[] {
    return [
      this.buildStreamUrl(streamId, 'm3u8'),  // HLS
      this.buildStreamUrl(streamId, 'ts'),     // MPEG-TS
      this.buildStreamUrl(streamId, 'rtmp')    // RTMP
    ];
  }

  /**
   * Sunucu bilgilerini al
   */
  getServerInfo(): XtreamAuthInfo | null {
    return this.authInfo;
  }
}
