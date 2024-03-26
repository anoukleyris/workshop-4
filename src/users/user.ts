import bodyParser from "body-parser";
import express from "express";
import { BASE_ONION_ROUTER_PORT, BASE_USER_PORT, REGISTRY_PORT } from "../config";
import { Node } from "@/src/registry/registry";
import { createRandomSymmetricKey, exportSymKey, importSymKey, rsaEncrypt, symEncrypt } from "../crypto";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

let lastReceivedMessage: string | null = null;
let lastSentMessage: string | null = null;
let lastCircuit: Node[] = [];


export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  // TODO implement the status route
  _user.get("/status", (req, res) => {
    res.send("live");
  });

  _user.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  _user.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
  });

  _user.post("/message", (req, res) => {
    lastReceivedMessage = req.body.message; // On stocke le dernier message reçu
    res.send("success");
  });

  _user.get("/getLastCircuit", (req, res) => {
    res.status(200).json({result: lastCircuit.map((node) => node.nodeId)});
  });

  _user.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body;
    let circuit: Node[] = [];

    const nodes = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`)
      .then((res) => res.json())
      .then((body: any) => body.nodes);

    while (circuit.length < 3) {
      const randomIndex = Math.floor(Math.random() * nodes.length);
      if (!circuit.map(node => node.nodeId).includes(nodes[randomIndex].nodeId)) {
        circuit.push(nodes[randomIndex]);
      }
    }

    // On prépare le message à envoyer
    lastSentMessage = message;
    let messageToSend = message;
    let destination = `${BASE_USER_PORT + destinationUserId}`.padStart(10, "0");

    for (let i = 0; i < circuit.length; i++) {
      const node = circuit[i];
      const symKey = await createRandomSymmetricKey(); // Générer une clé de chiffrement symétrique aléatoire
      const messageToEncrypt = `${destination}${messageToSend}`; // Ajouter l'identifiant du destinataire au message
      destination = `${BASE_ONION_ROUTER_PORT + node.nodeId}`.padStart(10, "0"); // Mettre à jour l'adresse de destination pour le prochain nœud
      const encryptedMessage = await symEncrypt(symKey, messageToEncrypt); // Chiffrer le message
      const encryptedSymKey = await rsaEncrypt(await exportSymKey(symKey), node.pubKey); // Chiffrer la clé symétrique avec la clé publique du nœud
      messageToSend = encryptedSymKey + encryptedMessage; // Préparer le message à envoyer au prochain nœud
    }

    circuit.reverse();

    // On envoie le message au premier nœud du circuit
    const entryNode = circuit[0];
    lastCircuit = circuit;
    await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + entryNode.nodeId}/message`, {
      method: "POST",
      body: JSON.stringify({ message: messageToSend }),
      headers: { "Content-Type": "application/json" },
    });

    res.send("success");
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(`User ${userId} is listening on port ${BASE_USER_PORT + userId}`);
  });

  return server;
}