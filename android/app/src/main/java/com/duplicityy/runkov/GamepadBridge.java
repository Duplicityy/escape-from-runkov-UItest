package com.duplicityy.runkov;

import android.content.Context;
import android.hardware.input.InputManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Map;
import java.util.TreeMap;

/** Android HID input covers USB-C/OTG and Bluetooth controllers identically. */
final class GamepadBridge implements InputManager.InputDeviceListener {
    private static final int BUTTONS = 17;
    private final InputManager inputManager;
    private final WebView webView;
    private final Map<Integer, Pad> pads = new TreeMap<>();
    private boolean disposed;

    private static final class Pad {
        final int deviceId;
        final String name;
        final float[] axes = new float[4];
        final boolean[] keys = new boolean[BUTTONS];
        final float[] triggers = new float[2];
        final boolean[] hat = new boolean[4];

        Pad(InputDevice device) {
            deviceId = device.getId();
            name = device.getName();
        }

        void clear() {
            java.util.Arrays.fill(axes, 0);
            java.util.Arrays.fill(keys, false);
            java.util.Arrays.fill(triggers, 0);
            java.util.Arrays.fill(hat, false);
        }

        JSONObject json() throws JSONException {
            JSONObject result = new JSONObject();
            result.put("id", "Android " + name);
            result.put("index", deviceId);
            result.put("connected", true);
            result.put("mapping", "standard");
            result.put("timestamp", SystemClock.uptimeMillis());
            JSONArray stick = new JSONArray();
            for (float axis : axes) stick.put(axis);
            result.put("axes", stick);
            JSONArray buttons = new JSONArray();
            for (int index = 0; index < BUTTONS; index++) {
                float value = keys[index] ? 1 : 0;
                if (index == 6 || index == 7) value = Math.max(value, triggers[index - 6]);
                if (index >= 12 && index <= 15 && hat[index - 12]) value = 1;
                JSONObject button = new JSONObject();
                button.put("pressed", value > 0.5f);
                button.put("touched", value > 0);
                button.put("value", value);
                buttons.put(button);
            }
            result.put("buttons", buttons);
            return result;
        }
    }

    GamepadBridge(Context context, WebView view) {
        inputManager = (InputManager) context.getSystemService(Context.INPUT_SERVICE);
        webView = view;
        inputManager.registerInputDeviceListener(this, new Handler(Looper.getMainLooper()));
        refresh();
    }

    private static boolean isController(InputDevice device) {
        if (device == null) return false;
        int sources = device.getSources();
        return (sources & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
            || (sources & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
    }

    private Pad pad(InputDevice device) {
        if (!isController(device)) return null;
        Pad pad = pads.get(device.getId());
        if (pad == null) {
            pad = new Pad(device);
            pads.put(device.getId(), pad);
        }
        return pad;
    }

    private static InputDevice.MotionRange range(InputDevice device, int axis) {
        InputDevice.MotionRange result = device.getMotionRange(axis, InputDevice.SOURCE_JOYSTICK);
        return result != null ? result : device.getMotionRange(axis);
    }

    private static float axis(MotionEvent event, InputDevice device, int axis) {
        InputDevice.MotionRange range = range(device, axis);
        if (range == null) return 0;
        float value = event.getAxisValue(axis);
        return Math.abs(value) <= range.getFlat() ? 0 : Math.max(-1, Math.min(1, value));
    }

    private static float trigger(MotionEvent event, InputDevice device, int preferred, int fallback) {
        int selected = range(device, preferred) != null ? preferred : fallback;
        InputDevice.MotionRange range = range(device, selected);
        if (range == null) return 0;
        float value = event.getAxisValue(selected);
        if (range.getMin() < 0 && range.getRange() > 0) value = (value - range.getMin()) / range.getRange();
        return Math.max(0, Math.min(1, value));
    }

    boolean motion(MotionEvent event) {
        InputDevice device = event.getDevice();
        Pad pad = pad(device);
        if (pad == null || event.getActionMasked() != MotionEvent.ACTION_MOVE) return false;
        pad.axes[0] = axis(event, device, MotionEvent.AXIS_X);
        pad.axes[1] = axis(event, device, MotionEvent.AXIS_Y);
        // Generic USB HID pads may expose Z/RZ as triggers and RX/RY as
        // their right stick. Xbox's usual Android Z/RZ pair is the fallback.
        boolean rotationalRight = range(device, MotionEvent.AXIS_RX) != null && range(device, MotionEvent.AXIS_RY) != null;
        pad.axes[2] = axis(event, device, rotationalRight ? MotionEvent.AXIS_RX : MotionEvent.AXIS_Z);
        pad.axes[3] = axis(event, device, rotationalRight ? MotionEvent.AXIS_RY : MotionEvent.AXIS_RZ);
        pad.triggers[0] = trigger(event, device, MotionEvent.AXIS_LTRIGGER, MotionEvent.AXIS_BRAKE);
        pad.triggers[1] = trigger(event, device, MotionEvent.AXIS_RTRIGGER, MotionEvent.AXIS_GAS);
        float hx = event.getAxisValue(MotionEvent.AXIS_HAT_X);
        float hy = event.getAxisValue(MotionEvent.AXIS_HAT_Y);
        pad.hat[0] = hy < -0.5f;
        pad.hat[1] = hy > 0.5f;
        pad.hat[2] = hx < -0.5f;
        pad.hat[3] = hx > 0.5f;
        publish();
        return true;
    }


    boolean key(KeyEvent event) {
        int index = GamepadMapping.button(event.getKeyCode());
        Pad pad = index < 0 ? null : pad(event.getDevice());
        if (pad == null || (event.getAction() != KeyEvent.ACTION_DOWN && event.getAction() != KeyEvent.ACTION_UP)) return false;
        boolean down = event.getAction() == KeyEvent.ACTION_DOWN;
        if (pad.keys[index] != down) {
            pad.keys[index] = down;
            publish();
        }
        return true;
    }

    void refresh() {
        for (int id : inputManager.getInputDeviceIds()) pad(inputManager.getInputDevice(id));
        pads.entrySet().removeIf(entry -> !isController(inputManager.getInputDevice(entry.getKey())));
        publish();
    }

    void clear() {
        for (Pad pad : pads.values()) pad.clear();
        publish();
    }

    void publish() {
        if (disposed || webView.getUrl() == null || !webView.getUrl().startsWith(MainActivity.GAME_ORIGIN + "/")) return;
        JSONArray array = new JSONArray();
        try {
            for (Pad pad : pads.values()) array.put(pad.json());
        } catch (JSONException ignored) {
            return;
        }
        String json = array.toString();
        webView.evaluateJavascript("window.__runkovAndroidGamepads=" + json
            + ";window.dispatchEvent(new Event('runkov-android-gamepads'));", null);
    }

    void dispose() {
        inputManager.unregisterInputDeviceListener(this);
        pads.clear();
        publish();
        disposed = true;
    }

    @Override public void onInputDeviceAdded(int deviceId) { refresh(); }
    @Override public void onInputDeviceChanged(int deviceId) {
        pads.remove(deviceId);
        refresh();
    }
    @Override public void onInputDeviceRemoved(int deviceId) {
        pads.remove(deviceId);
        publish();
    }
}
