import json

def flatten_json(y):
    out = {}

    def flatten(x, name=''):
        if type(x) is dict:
            for a in x:
                flatten(x[a], name + a + '.')
        elif type(x) is list:
            i = 0
            for a in x:
                flatten(a, name + str(i) + '.')
                i += 1
        else:
            out[name[:-1]] = x

    flatten(y)
    return out

with open('client/src/locales/en.json', 'r') as f:
    data = json.load(f)
    flat = flatten_json(data)
    for key in sorted(flat.keys()):
        print(key)
