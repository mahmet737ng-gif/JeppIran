#!/usr/bin/env python3
"""Public EMQX interoperability QA: real WSS subscriber and native MQTTS publisher.
This is a single synthetic packet; never put simulator/private location on this topic.
"""
import json, secrets, ssl, threading, time
import paho.mqtt.client as mqtt

HOST="broker.emqx.io"
TOPIC="jeppiran/relay-qa/v09/"+secrets.token_hex(12)
PAYLOAD=json.dumps({"source":"synthetic-relay-qa","token":secrets.token_hex(12)}).encode()
ws_conn=threading.Event()
tls_conn=threading.Event()
sub_ack=threading.Event()
received=threading.Event()
failures=[]
def subscriber_connected(client, userdata, flags, reason, properties):
    if reason!=0:
        failures.append("WSS MQTT CONNECT rejected: "+str(reason))
    else:
        print("PASS EMQX WSS/8084 MQTT CONNACK")
        ws_conn.set()
        client.subscribe(TOPIC,qos=1)
def suback(client, userdata, mid, reason_codes, properties):
    if any(c.is_failure for c in reason_codes):
        failures.append("WSS SUBACK rejected: "+str(reason_codes))
    else:
        sub_ack.set()
def message(client, userdata, msg):
    if msg.topic==TOPIC and msg.payload==PAYLOAD:
        received.set()
def publisher_connected(client, userdata, flags, reason, properties):
    if reason!=0:
        failures.append("TLS MQTT CONNECT rejected: "+str(reason))
    else:
        print("PASS EMQX MQTTS/8883 MQTT CONNACK")
        tls_conn.set()
def alarm(event,label,timeout=18):
    if not event.wait(timeout):
        raise RuntimeError(label+" TIMEOUT; "+str(failures))
def instance(name,transport):
    return mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
       client_id="jp_qa_"+name+"_"+secrets.token_hex(6),
       protocol=mqtt.MQTTv311,transport=transport)
sub=instance("sub","websockets")
pub=instance("pub","tcp")
sub.ws_set_options(path="/mqtt")
sub.tls_set(tls_version=ssl.PROTOCOL_TLS_CLIENT)
pub.tls_set(tls_version=ssl.PROTOCOL_TLS_CLIENT)
sub.on_connect=subscriber_connected
sub.on_subscribe=suback
sub.on_message=message
pub.on_connect=publisher_connected
try:
    sub.connect(HOST,8084,keepalive=30)
    sub.loop_start()
    alarm(ws_conn,"WSS CONNACK")
    alarm(sub_ack,"WSS SUBACK")
    pub.connect(HOST,8883,keepalive=30)
    pub.loop_start()
    alarm(tls_conn,"MQTTS CONNACK")
    info=pub.publish(TOPIC,PAYLOAD,qos=1,retain=False)
    info.wait_for_publish(timeout=18)
    if not info.is_published():
        raise RuntimeError("MTQTS QoS1 PUBACK missing")
    alarm(received,"WSS subscriber did not receive MQTTS publication")
    print("PASS LIVE CROSS-TRANSPORT: MQTTS/8883 → EMQX broker → WSS/8084; payload verified")
finally:
    for client in (sub,pub):
        try: client.disconnect()
        except Exception: pass
        try: client.loop_stop()
        except Exception: pass
