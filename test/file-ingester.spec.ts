import {FileIngester} from '../src/lib/file-ingester/file-ingester';
import * as config from 'config';
import {Logger} from '../src/lib/logger';
import {Container} from 'typedi';
import {DB} from '../src/db/index';
import {FileUploadBase} from '../src/shared/fileupload-base';
import * as sequelize from 'sequelize';
import {FileUpload} from '../src/db/models/FileUpload';

describe('File Ingester', () => {

  let fileIngester: FileIngester;
  let db: DB;

  const mockLocker: Logger = {
    log: (level: string, msg: string, ...meta: any[]) => {},
    silly: (msg: string, ...meta: any[]) => {},
    debug: (msg: string, ...meta: any[]) => {},
    info: (msg: string, ...meta: any[]) => {},
    warn: (msg: string, ...meta: any[]) => {},
    error: (msg: string, ...meta: any[]) => {}
  };

  beforeAll(async () => {
    db = Container.get(DB);
    await db.checkConnection(true);
  });

  afterAll(async () => {
    Container.get(DB).close();
  });

  beforeEach(() => {
    fileIngester = new FileIngester(mockLocker, config.get('db'));
  });

  describe('Ingester', () => {

    it('should exist', () => {
      expect(fileIngester).toBeDefined();
    });
  });

  describe('Validation', () => {

    it('should throw when no file given', (done) => {
      fileIngester.validateFile(null).catch(e => {
        expect(e.message).toEqual('file required');
        done();
      });
    });

    it('should validate a geojson file', async () => {

      const file: FileUploadBase = {
        path: 'test/fixtures/geojson1.json'
      };

      const fileUpload = await fileIngester.validateFile(file);

      expect(fileUpload.driver).toEqual('GeoJSON');
      expect(fileUpload.featureCount).toEqual(1);
      expect(fileUpload.geometryType).toEqual('Point');
      expect(fileUpload.srs).toEqual('WGS 84');
      expect(fileUpload.attributes.length).toEqual(4);
      expect(fileUpload.attributes[0]).toEqual({id: 'property1', type: 'string', precision: 0});
      expect(fileUpload.attributes[1]).toEqual({id: 'property2', type: 'integer', precision: 0});
      expect(fileUpload.attributes[2]).toEqual({id: 'property3', type: 'real', precision: 0});
      expect(fileUpload.attributes[3]).toEqual({id: 'property4', type: 'datetime', precision: 0});
    });

    it('should reject an unsupported file', async (done) => {

      const file: FileUploadBase = {
        path: 'test/fixtures/not_spatial.txt'
      };

      fileIngester.validateFile(file).catch(e => {
        expect(e).toBeDefined();
        done();
      });
    });
  });

  describe('Ingestion', () => {

    it('should throw when no file given', (done) => {
      fileIngester.ingestFile(null).catch(e => {
        expect(e.message).toEqual('file required');
        done();
      });
    });

    it('should ingest a geojson file', async () => {

      const file: FileUploadBase = {
        id: 'geojson1',
        path: 'test/fixtures/geojson1.json'
      };

      await fileIngester.ingestFile(file);

      const results = await db.sequelize.query(`SELECT * FROM  "${file.id}_data";`, {type: sequelize.QueryTypes.SELECT});
      const geomType = await db.sequelize.query(
        `SELECT ST_GeometryType("wkb_geometry") as geomtype 
        FROM  "${file.id}_data" LIMIT 1;`, {type: sequelize.QueryTypes.SELECT});

      await db.sequelize.query(`DROP TABLE "${file.id}_data";`);

      expect(results.length).toEqual(1);
      expect(results[0].property1).toEqual('text');
      expect(geomType[0].geomtype).toEqual('ST_MultiPoint');
    });
  });

  describe('Dataset creation', () => {

    it('should throw when no file given', (done) => {
      fileIngester.generateDataset(null).catch(e => {
        expect(e.message).toEqual('file required');
        done();
      });
    });

    it('should ingest a geojson file', async () => {

      const file = await FileUpload.create<FileUpload>({
        id: 'geojson2',
        path: 'test/fixtures/geojson1.json'
      });

      file.ogrInfo = await fileIngester.validateFile(file);
      file.ogrInfo.name = 'geojson1';

      await fileIngester.ingestFile(file);
      await fileIngester.generateDataset(file);
      await db.sequelize.query(`DROP TABLE "${file.id}_data";`);
    });
  });
});
