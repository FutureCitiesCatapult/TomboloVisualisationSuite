import {ChangeDetectionStrategy, Component, Input, OnChanges, OnInit} from '@angular/core';
import * as Debug from 'debug';
import {TomboloMapboxMap} from '../../../mapbox/tombolo-mapbox-map';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {Subscription} from 'rxjs/Subscription';

const debug = Debug('tombolo:map-metadata-editor');

@Component({
  selector: 'map-metadata-editor',
  templateUrl: './map-metadata-editor.html',
  styleUrls: ['./map-metadata-editor.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapMetadataEditorComponent implements OnInit, OnChanges {

  @Input() map: TomboloMapboxMap;

  form: FormGroup;

  _subs: Subscription[] = [];

  constructor() {
    this.form = new FormGroup({
      name: new FormControl('', Validators.required),
      description: new FormControl('', Validators.required),
      isPrivate: new FormControl(false, Validators.required)
    });
  }

  ngOnInit() {
    // Save form changes to map as user types
    this._subs.push(this.form.get('name').valueChanges.subscribe(val => {
      if (this.map) this.map.name = val;
    }));

    this._subs.push(this.form.get('description').valueChanges.subscribe(val => {
      if (this.map) this.map.description = val;
    }));

    this._subs.push(this.form.get('isPrivate').valueChanges.subscribe(val => {
      if (this.map) this.map.isPrivate = val;
    }));
  }

  ngOnDestroy() {
    this._subs.forEach(sub => sub.unsubscribe());
  }

  ngOnChanges(changes) {
    // Transfer values to form
    if (changes.map && changes.map.currentValue) {
      const val: TomboloMapboxMap = changes.map.currentValue;
      this.form.setValue({
        name: val.name,
        description: val.description,
        isPrivate: val.isPrivate
      });
    }
  }
}
