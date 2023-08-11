import pymongo
from bson import ObjectId
from pydantic import BaseModel
from pymongo.collection import Collection
from typing import Generic, List, Type, TypeVar, Union

import models


M = TypeVar('M', bound=BaseModel)


def _jsonify_oid(obj: Union[dict, ObjectId, None]):
    if obj is None:
        return None
    elif isinstance(obj, ObjectId):
        return obj.binary.hex()
    else:
        obj["id"] = obj.pop("_id").binary.hex()
        return obj


def _prepare_filter(obj: Union[dict, str, None]):
    if obj is None:
        return {}

    elif isinstance(obj, str):
        return {"_id": ObjectId(obj)}

    else:
        id = obj.pop("id", None)
        if id is not None:
            obj["_id"] = ObjectId(id)
        return obj


class DocumentCollection(Generic[M]):
    def __init__(self, collection: Collection, model: Type[M]):
        self.collection: Collection = collection
        self.model: M = model
        self.name: str = collection.name
        self.collection.create_index("name")

    def create(self, obj):
        obj["id"] = self.insert(obj)
        return self.model.parse_obj(obj)

    def pre_process_filter(self, filter: dict):
        return _prepare_filter(filter)

    def post_process_result(self, document: dict) -> M:
        if document is None:
            return None
        return self.model.parse_obj(_jsonify_oid(document))

    def create_index(self, *args, **kwargs):
        self.collection.create_index(*args, **kwargs)

    def get(self, filter: Union[dict, str]) -> M:
        return self.post_process_result(self.collection.find_one(self.pre_process_filter(filter)))

    def find(self, filter: dict = None, *args, **kwargs) -> List[M]:
        return [self.post_process_result(document) for document in self.collection.find(self.pre_process_filter(filter), *args, **kwargs)]

    def delete(self, filter: dict = None, *args, **kwargs):
        return self.collection.delete_one(self.pre_process_filter(filter), *args, **kwargs).deleted_count != 0

    def multiple_delete(self, filter: dict = None, *args, **kwargs):
        return self.collection.delete_many(self.pre_process_filter(filter), *args, **kwargs).deleted_count

    def update(self, filter: dict, update: dict, *args, **kwargs):
        self.collection.update_one(self.pre_process_filter(filter), update, *args, **kwargs)

    def multiple_update(self, filter: dict, update: dict, *args, **kwargs):
        self.collection.update_many(self.pre_process_filter(filter), update, *args, **kwargs)

    def upsert(self, filter: dict, update: dict, *args, **kwargs):
        return _jsonify_oid(self.collection.update_one(self.pre_process_filter(filter), update, *args, **kwargs, upsert=True).upserted_id)

    def insert(self, *args, **kwargs) -> str:
        return _jsonify_oid(self.collection.insert_one(*args, **kwargs).inserted_id)

    def multiple_insert(self, *args, **kwargs) -> List[str]:
        return [_jsonify_oid(id) for id in self.collection.insert_many(*args, **kwargs).inserted_ids]


# Mongo Client
client = pymongo.MongoClient("mongodb://nonsense_db:27017")
db = client.nonsense_db

# Collections
characters = DocumentCollection(db.characters, models.Character)
items = DocumentCollection(db.items, models.Item)
users = DocumentCollection(db.users, models.User)
combats = DocumentCollection(db.combats, models.Combat)

sessions = DocumentCollection(db.sessions, models.Session)
sessions.create_index("auth_token")
sessions.create_index("last_auth_date", expireAfterSeconds=86400)
