//Filtering and where clauses for grid queries ultimately sent to server by itemsViewModel
var filterOpToQueryOp = {
    In: { name: "in", cast: String },
    Contains: { name: "like", cast: String },
    NotContains: { name: "notLike", cast: String },
    StartsWith: { name: "startsWith", cast: String },
    EndsWith: { name: "endsWith", cast: String },
    EqualTo: { name: "eq", cast: Number },
    EqualToString: { name: "eqString", cast: String },
    LessThan: { name: "lt", cast: Number },
    GreaterThan: { name: "gt", cast: Number },
    NotEqualTo: { name: "neq", cast: Number },
    NotEqualToString: { name: "neqString", cast: String },
    NotEmpty: { name: "notEmpty" }
};


export default function toQueryFilters(filters) {
    var queryFilters = {};
    filters.forEach(function (filter) {
        var queryOperator = filterOpToQueryOp[filter.op];

        if (queryOperator.name !== "NotEmpty") {
            var values = queryOperator.cast != null
                ? filter.values.map(function (val) { return queryOperator.cast(val); })
                : filter.values;

            if (filter.op === "In") {
                // "In", unlike other operations, can take an array of values:
                queryFilters[filter.column] = {
                    op: queryOperator.name,
                    value: values.join(",")
                };
            } else {
                // Create multiple instances of each filter for each value in the filter's values array:
                values.forEach(function(value) {
                    // Add filter to query:
                    queryFilters[filter.column] = {
                        op: queryOperator.name,
                        value: value
                    };

                });
            }
        } else {
            //Not Empty has no values
            queryFilters[filter.column] = {
                op: queryOperator.name
            };

        }

        //See if there is a tag
        if (filter.tag != null)
            queryFilters.last().tag = filter.tag;

        if (filter.logicOperator != null)
            queryFilters.last().logicOperator = filter.logicOperator;
    });
    return queryFilters;
}

