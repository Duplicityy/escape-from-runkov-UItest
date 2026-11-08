package com.duplicityy.runkov;

import android.view.KeyEvent;
import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class GamepadMappingTest {
    @Test public void androidButtonsMatchTheBrowserStandardGamepadContract() {
        int[] nativeButtons = {
            KeyEvent.KEYCODE_BUTTON_A, KeyEvent.KEYCODE_BUTTON_B,
            KeyEvent.KEYCODE_BUTTON_X, KeyEvent.KEYCODE_BUTTON_Y,
            KeyEvent.KEYCODE_BUTTON_L1, KeyEvent.KEYCODE_BUTTON_R1,
            KeyEvent.KEYCODE_BUTTON_L2, KeyEvent.KEYCODE_BUTTON_R2,
            KeyEvent.KEYCODE_BUTTON_SELECT, KeyEvent.KEYCODE_BUTTON_START,
            KeyEvent.KEYCODE_BUTTON_THUMBL, KeyEvent.KEYCODE_BUTTON_THUMBR,
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN,
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_BUTTON_MODE,
        };
        for (int standardIndex = 0; standardIndex < nativeButtons.length; standardIndex++) {
            assertEquals(standardIndex, GamepadMapping.button(nativeButtons[standardIndex]));
        }
    }

    @Test public void controllerBackCanReachTheGameWithoutExitingTheActivity() {
        assertEquals(1, GamepadMapping.button(KeyEvent.KEYCODE_BACK));
    }

    @Test public void ordinaryKeyboardAndVolumeKeysAreNotClaimedAsGamepadButtons() {
        assertEquals(-1, GamepadMapping.button(KeyEvent.KEYCODE_ENTER));
        assertEquals(-1, GamepadMapping.button(KeyEvent.KEYCODE_SPACE));
        assertEquals(-1, GamepadMapping.button(KeyEvent.KEYCODE_VOLUME_UP));
        assertEquals(-1, GamepadMapping.button(KeyEvent.KEYCODE_VOLUME_DOWN));
    }
}
