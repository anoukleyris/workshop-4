import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";

export type Node = { nodeId: number; pubKey: string };

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = {
  nodes: Node[];
};

export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());
  let noeuds: Node[] = [];

  // TODO implement the status route
  _registry.get("/status", (req, res) => {
    res.send("live");
  });

  // Route pour enregistrer un nouveau nœud
  _registry.post("/registerNode", (req, res) => {
    const { nodeId, pubKey }: RegisterNodeBody = req.body;

    // On vérifie si le nœud est déjà enregistré
    const nodeExists = noeuds.find(node => node.nodeId === nodeId);
    if (nodeExists) {
      return res.status(400).json({ message: "Node already registered." });
    }

    // On ajoute le nouveau nœud au registre
    noeuds.push({ nodeId, pubKey });
    return res.status(201).json({ message: "Node registered successfully." });
    
  });

  // Route pour récupérer le registre des nœuds
  _registry.get("/getNodeRegistry", (req: Request, res: Response) => {
    const payload: GetNodeRegistryBody = {
      nodes: noeuds
    };

    res.json(payload);
  }); 

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}