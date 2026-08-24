package com.se7enfit.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(SE7ENHealthPlugin.class);
    registerPlugin(SE7ENSecureStoragePlugin.class);
    registerPlugin(SE7ENActivityTrackerPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
