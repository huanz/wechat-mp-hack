import { existsSync, mkdirSync, readFileSync, writeFileSync, writeFile } from 'fs';
import { join } from 'path';

export default class Cache {
  cacheDir: string;
  cacheFile: string;
  _data: any;

  constructor(cacheName: string) {
    this.cacheDir = join(__dirname, '..', 'cache');
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir);
    }
    this.cacheFile = join(this.cacheDir, `${cacheName}.json`);
    try {
      let data = readFileSync(this.cacheFile, 'utf8');
      this._data = JSON.parse(data);
    } catch (error) {
      writeFileSync(this.cacheFile, '{}');
      this._data = {};
    }
  }
  get(key: string) {
    return this._data[key];
  }
  set(key: string, value: any) {
    this._data[key] = value;
    this._save();
  }
  clear() {
    this._data = {};
    this._save();
  }
  _save() {
    writeFile(this.cacheFile, JSON.stringify(this._data), 'utf8', () => {});
  }
}
