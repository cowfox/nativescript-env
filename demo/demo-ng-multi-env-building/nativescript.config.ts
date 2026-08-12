import { NativeScriptConfig } from '@nativescript/core';
import { getAppId } from '@wuneo/nativescript-env/helper';

export default {
  id: getAppId(__dirname, 'org.nativescript.demo.multienvbuilding'),
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  android: {
    v8Flags: '--expose_gc',
  }
} as NativeScriptConfig;
