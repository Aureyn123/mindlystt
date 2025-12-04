// Gestion des contacts
import crypto from "crypto";
import { prisma } from "./prisma";
import { readUsers } from "./auth";

export type Contact = {
  id: string;
  userId: string; // Utilisateur qui a ajouté ce contact
  contactUserId: string; // ID de l'utilisateur contact
  contactUsername: string; // Pseudo du contact (pour affichage rapide)
  contactEmail: string; // Email du contact (pour affichage)
  createdAt: number;
};

export type ContactRequest = {
  id: string;
  requesterId: string; // ID de l'utilisateur qui demande
  requesterUsername: string; // Pseudo du demandeur
  requesterEmail: string; // Email du demandeur
  recipientId: string; // ID de l'utilisateur qui reçoit la demande
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
};

export async function getUserContacts(userId: string): Promise<Contact[]> {
  const contacts = await prisma.contact.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  
  return contacts.map(contact => ({
    id: contact.id,
    userId: contact.userId,
    contactUserId: contact.contactUserId,
    contactUsername: contact.contactUsername,
    contactEmail: contact.contactEmail,
    createdAt: contact.createdAt.getTime(),
  }));
}

export async function createContactRequest(requesterId: string, recipientId: string): Promise<ContactRequest> {
  // Vérifier qu'on ne s'ajoute pas soi-même
  if (requesterId === recipientId) {
    throw new Error("Tu ne peux pas t'ajouter toi-même comme contact");
  }

  // Vérifier que le contact n'existe pas déjà
  const existingContact = await prisma.contact.findFirst({
    where: {
      OR: [
        { userId: requesterId, contactUserId: recipientId },
        { userId: recipientId, contactUserId: requesterId },
      ],
    },
  });
  
  if (existingContact) {
    throw new Error("Ce contact existe déjà");
  }

  // Vérifier qu'il n'y a pas déjà une demande en attente
  const existingRequest = await prisma.contactRequest.findFirst({
    where: {
      requesterId,
      recipientId,
      status: "pending",
    },
  });
  
  if (existingRequest) {
    throw new Error("Une demande est déjà en attente");
  }

  // Récupérer les infos du demandeur
  const requesterUser = await prisma.user.findUnique({
    where: { id: requesterId },
  });
  
  if (!requesterUser) {
    throw new Error("Utilisateur non trouvé");
  }

  const newRequest = await prisma.contactRequest.create({
    data: {
      requesterId,
      requesterUsername: requesterUser.username,
      requesterEmail: requesterUser.email,
      recipientId,
      status: "pending",
    },
  });

  return {
    id: newRequest.id,
    requesterId: newRequest.requesterId,
    requesterUsername: newRequest.requesterUsername,
    requesterEmail: newRequest.requesterEmail,
    recipientId: newRequest.recipientId,
    status: newRequest.status as "pending" | "accepted" | "rejected",
    createdAt: newRequest.createdAt.getTime(),
  };
}

export async function acceptContactRequest(requestId: string, userId: string): Promise<Contact> {
  const request = await prisma.contactRequest.findFirst({
    where: {
      id: requestId,
      recipientId: userId,
      status: "pending",
    },
  });
  
  if (!request) {
    throw new Error("Demande non trouvée ou déjà traitée");
  }

  // Marquer la demande comme acceptée
  await prisma.contactRequest.update({
    where: { id: requestId },
    data: { status: "accepted" },
  });

  // Récupérer les utilisateurs
  const requesterUser = await prisma.user.findUnique({
    where: { id: request.requesterId },
  });
  
  const recipientUser = await prisma.user.findUnique({
    where: { id: request.recipientId },
  });
  
  if (!requesterUser || !recipientUser) {
    throw new Error("Utilisateur non trouvé");
  }

  // Créer les contacts dans les deux sens (relation bidirectionnelle)
  // Contact 1 : requester -> recipient
  await prisma.contact.create({
    data: {
      userId: request.requesterId,
      contactUserId: request.recipientId,
      contactUsername: recipientUser.username,
      contactEmail: recipientUser.email,
    },
  });

  // Contact 2 : recipient -> requester
  const contact2 = await prisma.contact.create({
    data: {
      userId: request.recipientId,
      contactUserId: request.requesterId,
      contactUsername: requesterUser.username,
      contactEmail: requesterUser.email,
    },
  });

  return {
    id: contact2.id,
    userId: contact2.userId,
    contactUserId: contact2.contactUserId,
    contactUsername: contact2.contactUsername,
    contactEmail: contact2.contactEmail,
    createdAt: contact2.createdAt.getTime(),
  };
}

export async function rejectContactRequest(requestId: string, userId: string): Promise<void> {
  const request = await prisma.contactRequest.findFirst({
    where: {
      id: requestId,
      recipientId: userId,
      status: "pending",
    },
  });
  
  if (!request) {
    throw new Error("Demande non trouvée ou déjà traitée");
  }

  await prisma.contactRequest.update({
    where: { id: requestId },
    data: { status: "rejected" },
  });
}

export async function getPendingContactRequests(userId: string): Promise<ContactRequest[]> {
  const requests = await prisma.contactRequest.findMany({
    where: {
      recipientId: userId,
      status: "pending",
    },
    orderBy: { createdAt: "desc" },
  });
  
  return requests.map(request => ({
    id: request.id,
    requesterId: request.requesterId,
    requesterUsername: request.requesterUsername,
    requesterEmail: request.requesterEmail,
    recipientId: request.recipientId,
    status: request.status as "pending" | "accepted" | "rejected",
    createdAt: request.createdAt.getTime(),
  }));
}

export async function addContact(userId: string, contactUserId: string): Promise<Contact | null> {
  // Cette fonction est maintenant obsolète, on utilise createContactRequest à la place
  // Mais on la garde pour la rétrocompatibilité
  
  const existing = await prisma.contact.findFirst({
    where: {
      userId,
      contactUserId,
    },
  });
  
  if (existing) {
    return {
      id: existing.id,
      userId: existing.userId,
      contactUserId: existing.contactUserId,
      contactUsername: existing.contactUsername,
      contactEmail: existing.contactEmail,
      createdAt: existing.createdAt.getTime(),
    };
  }

  if (userId === contactUserId) {
    throw new Error("Tu ne peux pas t'ajouter toi-même comme contact");
  }

  const contactUser = await prisma.user.findUnique({
    where: { id: contactUserId },
  });
  
  if (!contactUser) {
    throw new Error("Utilisateur non trouvé");
  }

  const newContact = await prisma.contact.create({
    data: {
      userId,
      contactUserId,
      contactUsername: contactUser.username,
      contactEmail: contactUser.email,
    },
  });

  return {
    id: newContact.id,
    userId: newContact.userId,
    contactUserId: newContact.contactUserId,
    contactUsername: newContact.contactUsername,
    contactEmail: newContact.contactEmail,
    createdAt: newContact.createdAt.getTime(),
  };
}

export async function removeContact(userId: string, contactId: string): Promise<boolean> {
  const deleted = await prisma.contact.deleteMany({
    where: {
      id: contactId,
      userId,
    },
  });
  
  return deleted.count > 0;
}

export async function findUserByUsername(username: string): Promise<{ id: string; email: string; username: string } | null> {
  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
      },
    },
    select: {
      id: true,
      email: true,
      username: true,
    },
  });
  
  return user;
}

export async function searchUsersByUsername(query: string, excludeUserId: string): Promise<Array<{ id: string; email: string; username: string }>> {
  const users = await prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      username: {
        contains: query,
      },
    },
    select: {
      id: true,
      email: true,
      username: true,
    },
    take: 10, // Limiter à 10 résultats
  });
  
  return users;
}
