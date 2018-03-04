import {IBasemap} from '../IBasemap';
import {IMapDefinition} from '../IMapDefinition';
import {ILabelLayerStyleMetadata, IStyle, IStyleMetadata} from '../IStyle';
import {IMapLayer} from '../IMapLayer';
import {ITomboloDataset} from '../ITomboloDataset';

export const DATA_LAYER_ID = 'data';
const DATA_LAYER_PREFIX = 'datalayer-';
const LABEL_LAYER_PREFIX = 'labellayer-';

const MIN_POINT_RADIUS = 3;
const MAX_POINT_RADIUS = 20;

export class StyleGenerator {

  private mapDefinition: IMapDefinition;

  constructor() {}

  generateMapStyle(basemap: IBasemap, mapDefinition: IMapDefinition, baseUrl: string) {

    this.mapDefinition = mapDefinition;

    let style = basemap.style;
    style.metadata = style.metadata || {} as IStyleMetadata;
    style.metadata.mapDefinition = mapDefinition;
    style.zoom = mapDefinition.zoom || style.zoom;
    style.center = mapDefinition.center || style.center;
    style.sources = {...style['sources'], ...this.generateSources(mapDefinition)};
    style.sources = this.expandTileSources(baseUrl, style.sources);


    // Find layer indices of insertion points
    let insertionPoints = style.metadata.insertionPoints || {};

    // Create and insert map layers
    mapDefinition.layers.forEach(layer => {
      const layerStyle = this.generateMapLayer(layer);
      const insertionPoint = insertionPoints[layer.layerType];
      this.insertMapLayer(insertionPoint, style, layerStyle);
    });

    // Create and insert label layers
    const labelAttributeStyle = style.metadata.labelLayerStyle;
    if (!labelAttributeStyle) {
      throw new Error(`No label layer style for basemap ${basemap.name}`);
    }
    else {
      mapDefinition.layers.filter(layer => layer.labelAttribute !== null).forEach(layer => {
        const labelLayerStyle = this.generateLabelLayer(layer, labelAttributeStyle);
        const insertionPoint = insertionPoints['label'];
        this.insertMapLayer(insertionPoint, style, labelLayerStyle);
      });
    }

    return style;
  }

  private generateSources(mapDefinition: IMapDefinition): object {
    return  mapDefinition.layers.reduce((accum, layer) => {
      accum[layer.datasetId] = this.generateMapStyleSource(layer);
      return accum;
    }, {});
  }
  private generateMapStyleSource(layer: IMapLayer): object {
    return {
      type: 'vector',
      url: `${layer.datasetId}/index.json`
    };
  }

  private expandTileSources(baseUrl: string, sources: object): object {
    return Object.keys(sources).reduce((accum, key) => {
      let source = sources[key];

      // For vector source with tileJSON url
      if (source.hasOwnProperty('url')) {
        source = {...source, url: this.expandRelativeTileURL(baseUrl, source['url'])};
      }

      // For vector sources with inline tiles url
      if (source.hasOwnProperty('tiles')) {
        source = {...source, tiles: source['tiles'].map(tileUrl => this.expandRelativeTileURL(baseUrl, tileUrl))};
      }

      // For geojson sources
      if (source.hasOwnProperty('data')) {
        source = {...source, data: this.expandRelativeTileURL(baseUrl, source['data'])};
      }

      accum[key] = source;

      return accum;
    }, {});
  }

  private expandRelativeTileURL(baseUrl, url: string): string {
    return (url.startsWith('http')) ? url : baseUrl + url;
  }

  private generateMapLayer(layer: IMapLayer): object {

    const dataset = this.datasetForLayer(layer);

    return {
      id: DATA_LAYER_PREFIX + layer.layerId,
      source: layer.datasetId,
      'source-layer':  DATA_LAYER_ID,
      type: layer.layerType,
      minzoom: dataset.minZoom,
      maxzoom: dataset.maxZoom,
      paint: this.paintStyleForLayer(layer),
      filter: ['has', layer.datasetAttribute]
    };
  }

  private generateLabelLayer(layer: IMapLayer, labelAttributeStyle: ILabelLayerStyleMetadata): object {

    if (layer.labelAttribute === null) return null;

    let layout = {...labelAttributeStyle.layout, 'text-field': `{${layer.labelAttribute}}`};
    let paint = {...labelAttributeStyle.paint};

    switch (layer.layerType) {
      case 'circle':
        // TODO - make label offset based on circle radius when expressions returning arrays are supported by mapboxgl.
        layout['text-offset'] = [0, 2.5];
        break;
      case 'line':
        layout['symbol-placement'] = 'line';
        break;
    }

    return {
      layout: layout, paint: paint,
      source: layer.datasetId,
      'source-layer': DATA_LAYER_ID,
      type: 'symbol',
      id: LABEL_LAYER_PREFIX + layer.layerId,
      filter: ['has', layer.datasetAttribute]
    };
  }

  private datasetForLayer(layer: IMapLayer): ITomboloDataset {
    return this.mapDefinition.datasets.find(ds => ds.id === layer.datasetId);
  }

  private paintStyleForLayer(layer: IMapLayer): object {

    const dataset = this.datasetForLayer(layer);

    if (layer.layerType === 'fill') {
      return {
        'fill-color': this.colorRampForLayer(layer),
        'fill-outline-color': 'white',
        'fill-opacity': ['interpolate', ['linear'], ['zoom'],
          dataset.minZoom, 0,
          dataset.minZoom + 0.5, layer.opacity || 1
        ]
      };
    }
    else if (layer.layerType === 'circle') {
      return {
        'circle-color': this.colorRampForLayer(layer),
        'circle-radius': this.radiusRampForLayer(layer),
        'circle-opacity': ['interpolate', ['linear'], ['zoom'],
          dataset.minZoom, 0,
          dataset.minZoom + 0.5, layer.opacity || 1
        ]
      };
    }
    else if (layer.layerType === 'line') {
      return {
        'line-color': this.colorRampForLayer(layer),
        'line-width': {
          base: 1.3,
          stops: [[10, 2], [20, 20]]
        },
        'line-opacity': ['interpolate', ['linear'], ['zoom'],
          dataset.minZoom, 0,
          dataset.minZoom + 0.5, layer.opacity || 1
        ]
      };
    }
  }

  private colorRampForLayer(layer: IMapLayer): any {

    const dataset = this.datasetForLayer(layer);
    const dataAttribute = dataset.dataAttributes.find(d => d.field === layer.datasetAttribute);

    if (!dataAttribute) {
      throw new Error(`Data attribute '${layer.datasetAttribute} not found on dataset`);
    }

    const colorStops = layer.palette.colorStops;
    if (layer.paletteInverted) colorStops.reverse();

    // TODO - support fixed colors
    if (dataAttribute.quantiles5) {
      const stops = dataAttribute.quantiles5.map((val, i) => [val, layer.palette.colorStops[i]]).reduce((a, b) => a.concat(b), []);

      return [
        'interpolate',
        ['linear'],
        ['get', layer.datasetAttribute],
        ...stops
      ];
    }
    else {
      return 'red';
    }
  }

  private radiusRampForLayer(layer: IMapLayer): object {

    const dataset = this.datasetForLayer(layer);
    const dataAttribute = dataset.dataAttributes.find(d => d.field === layer.datasetAttribute);

    if (!dataAttribute) {
      throw new Error(`Data attribute '${layer.datasetAttribute} not found on dataset`);
    }

    const radiusRange = MAX_POINT_RADIUS - MIN_POINT_RADIUS;
    const radiusPerStop = radiusRange / 5;

    const stops = dataAttribute.quantiles5.map((val, i) => [val, MIN_POINT_RADIUS + radiusPerStop * i]).reduce((a, b) => a.concat(b), []);

    return [
      'interpolate',
      ['linear'],
      ['get', layer.datasetAttribute],
      ...stops
    ];
  }

  private insertMapLayer(insertionPoint: string, style: IStyle, layer: object): void {
    const index = style.layers.findIndex(l => l['id'] === insertionPoint);
    style['layers'].splice(index, 0, layer);
  }
}
