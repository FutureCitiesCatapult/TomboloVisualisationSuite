import {Component, HostBinding, OnInit} from '@angular/core';
import * as Debug from 'debug';

import {Router} from '@angular/router';
import {Subscription} from 'rxjs/Subscription';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {AuthService} from '../auth.service';
import {Angulartics2} from 'angulartics2';

const debug = Debug('tombolo:password-reset-dialog');

@Component({
  selector: 'my-account--component',
  templateUrl: './my-account.html',
  styleUrls: ['../auth-panel.scss']
})
export class MyAccountDialogComponent implements OnInit {

  @HostBinding('class.auth-panel-component') authPanelComponentClass = true;

  constructor(
    private router: Router,
    private authService: AuthService,
    private analytics: Angulartics2) {}

  private _subs: Subscription[] = [];

  ngOnInit() {
  }

  ngOnDestroy() {
    this._subs.forEach(sub => sub.unsubscribe());
  }

  close() {
    this.router.navigate([{outlets: {'loginBox': null}}]);
  }

}
