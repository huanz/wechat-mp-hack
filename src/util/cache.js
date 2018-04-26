import * as fs from 'fs';
import path from 'path';

export default class Cache {
    constructor(cacheName) {
        this.cacheDir = path.join(__dirname, '..', 'cache');
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir);
        }
        this.cacheFile = path.join(this.cacheDir, `${cacheName}.json`);
        try {
            let data = fs.readFileSync(this.cacheFile, 'utf8');
            this._data = JSON.parse(data);
        } catch (error) {
            fs.writeFileSync(this.cacheFile, '{}');
            this._data = {};
        }
    }
    get(key) {
        return this._data[key];
    }
    set(key, value) {
        this._data[key] = value;
        this._save();
    }
    clear() {
        this._data = {};
        this._save();
    }
    _save() {
        fs.writeFile(this.cacheFile, JSON.stringify(this._data), 'utf8', () => {});
    }
}
